import { sql } from 'drizzle-orm'

import { config } from './config'
import { db } from './db'
import { withRetry } from './retry'

export class SamplerParseError extends Error {
  constructor(field: string, chatId: string, cause: unknown) {
    super(
      `SamplerParseError: Failed to parse ${field} for chat ${chatId}: ${cause instanceof Error ? cause.message : String(cause)}`
    )
    this.name = 'SamplerParseError'
  }
}

export interface ChatSample {
  chatId: string
  createdAt: Date
  userQuery: string
  searchResults: Array<{
    query: string
    results: Array<{ title: string; url: string; snippet: string }>
  }>
  modelAnswer: string
  citations: Array<{ url: string; title: string }>
  toolNames: string[]
}

/**
 * Sample recent chats from Supabase Postgres for evaluation.
 *
 * Joins chats → messages → parts to reconstruct:
 * - The user's question (first user message text)
 * - Search tool outputs (context / retrieved documents)
 * - The assistant's answer (last assistant message text)
 * - Citations (source_url parts)
 *
 * RLS note: This query must run as the DB owner (not app_user)
 * since the evals service needs cross-user read access.
 */
export async function sampleRecentChats(): Promise<ChatSample[]> {
  const { sampleSize, lookbackHours } = config

  // Raw SQL query — more efficient than Drizzle ORM for this complex join.
  // We need to aggregate parts across messages within each chat.
  const rows = await withRetry(
    () =>
      db.execute<{
        chat_id: string
        created_at: Date
        user_query: string
        search_results: string | null
        model_answer: string
        citations: string | null
        tool_names: string | null
      }>(sql`
    WITH recent_chats AS (
      SELECT id, created_at
      FROM chats
      WHERE created_at > NOW() - make_interval(hours => ${lookbackHours})
      ORDER BY RANDOM()
      LIMIT ${sampleSize}
    ),
    user_queries AS (
      SELECT DISTINCT ON (m.chat_id)
        m.chat_id,
        p.text_text AS user_query
      FROM messages m
      JOIN parts p ON p.message_id = m.id
      WHERE m.chat_id IN (SELECT id FROM recent_chats)
        AND m.role = 'user'
        AND p.type = 'text'
        AND p.text_text IS NOT NULL
      ORDER BY m.chat_id, m.created_at ASC, p."order" ASC
    ),
    assistant_answers AS (
      SELECT DISTINCT ON (m.chat_id)
        m.chat_id,
        p.text_text AS model_answer
      FROM messages m
      JOIN parts p ON p.message_id = m.id
      WHERE m.chat_id IN (SELECT id FROM recent_chats)
        AND m.role = 'assistant'
        AND p.type = 'text'
        AND p.text_text IS NOT NULL
      ORDER BY m.chat_id, m.created_at DESC, p."order" DESC
    ),
    search_data AS (
      SELECT
        m.chat_id,
        json_agg(p.tool_search_output) FILTER (WHERE p.tool_search_output IS NOT NULL) AS search_results
      FROM messages m
      JOIN parts p ON p.message_id = m.id
      WHERE m.chat_id IN (SELECT id FROM recent_chats)
        AND p.type = 'tool-search'
        AND p.tool_state = 'output-available'
      GROUP BY m.chat_id
    ),
    citation_data AS (
      SELECT
        m.chat_id,
        json_agg(json_build_object(
          'url', p.source_url_url,
          'title', p.source_url_title
        )) AS citations
      FROM messages m
      JOIN parts p ON p.message_id = m.id
      WHERE m.chat_id IN (SELECT id FROM recent_chats)
        AND p.type = 'source-url'
      GROUP BY m.chat_id
    ),
    tool_data AS (
      SELECT
        m.chat_id,
        json_agg(DISTINCT COALESCE(p.tool_dynamic_name, substring(p.type from 6)))
          FILTER (WHERE p.type LIKE 'tool-%') AS tool_names
      FROM messages m
      JOIN parts p ON p.message_id = m.id
      WHERE m.chat_id IN (SELECT id FROM recent_chats)
        AND p.type LIKE 'tool-%'
      GROUP BY m.chat_id
    )
    SELECT
      rc.id AS chat_id,
      rc.created_at,
      uq.user_query,
      sd.search_results::text,
      aa.model_answer,
      cd.citations::text,
      td.tool_names::text
    FROM recent_chats rc
    JOIN user_queries uq ON uq.chat_id = rc.id
    JOIN assistant_answers aa ON aa.chat_id = rc.id
    LEFT JOIN search_data sd ON sd.chat_id = rc.id
    LEFT JOIN citation_data cd ON cd.chat_id = rc.id
    LEFT JOIN tool_data td ON td.chat_id = rc.id
    WHERE uq.user_query IS NOT NULL
      AND aa.model_answer IS NOT NULL
  `),
    { maxAttempts: 3, baseDelayMs: 2000 }
  )

  const samples: ChatSample[] = []
  let parseFailures = 0

  for (const row of rows) {
    try {
      samples.push({
        chatId: row.chat_id,
        createdAt: row.created_at,
        userQuery: row.user_query,
        searchResults: parseSearchResults(row.search_results),
        modelAnswer: row.model_answer,
        citations: parseCitations(row.citations),
        toolNames: parseToolNames(row.tool_names)
      })
    } catch (err) {
      parseFailures++
      console.warn(
        `[evals] Skipping chat ${row.chat_id} due to parse error:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  if (parseFailures > 0) {
    console.warn(
      `[evals] ${parseFailures}/${rows.length} chats skipped due to parse failures`
    )
  }

  return samples
}

export function parseToolNames(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (name: unknown): name is string =>
        typeof name === 'string' && name.length > 0
    )
  } catch (err) {
    throw new SamplerParseError('tool_names', 'unknown', err)
  }
}

export function parseCitations(
  raw: string | null
): Array<{ url: string; title: string }> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((c: Record<string, unknown>) => ({
      url: String(c?.url ?? ''),
      title: String(c?.title ?? '')
    }))
  } catch (err) {
    throw new SamplerParseError('citations', 'unknown', err)
  }
}

export function parseSearchResults(raw: string | null): Array<{
  query: string
  results: Array<{ title: string; url: string; snippet: string }>
}> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((result: Record<string, unknown>) => ({
      query: String(result?.query ?? ''),
      results: Array.isArray(result?.results)
        ? (result.results as Record<string, unknown>[]).map(r => ({
            title: String(r?.title ?? ''),
            url: String(r?.url ?? ''),
            snippet: String(r?.snippet ?? r?.content ?? '')
          }))
        : []
    }))
  } catch (err) {
    throw new SamplerParseError('search_results', 'unknown', err)
  }
}
