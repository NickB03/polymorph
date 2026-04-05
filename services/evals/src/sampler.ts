import { sql } from 'drizzle-orm'

import { config } from './config'
import { db } from './db'
import { withRetry } from './retry'

export interface MultiTurnChatSample extends Omit<
  ChatSample,
  'userQuery' | 'modelAnswer'
> {
  conversation: Array<{ role: 'user' | 'assistant'; text: string }>
  toolNames: string[]
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
    )
    SELECT
      rc.id AS chat_id,
      rc.created_at,
      uq.user_query,
      sd.search_results::text,
      aa.model_answer,
      cd.citations::text
    FROM recent_chats rc
    JOIN user_queries uq ON uq.chat_id = rc.id
    JOIN assistant_answers aa ON aa.chat_id = rc.id
    LEFT JOIN search_data sd ON sd.chat_id = rc.id
    LEFT JOIN citation_data cd ON cd.chat_id = rc.id
    WHERE uq.user_query IS NOT NULL
      AND aa.model_answer IS NOT NULL
  `),
    { maxAttempts: 3, baseDelayMs: 2000 }
  )

  return rows.map(row => ({
    chatId: row.chat_id,
    createdAt: row.created_at,
    userQuery: row.user_query,
    searchResults: parseSearchResults(row.search_results),
    modelAnswer: row.model_answer,
    citations: parseCitations(row.citations)
  }))
}

/**
 * Sample recent multi-turn chats from Supabase Postgres for evaluation.
 *
 * Filters for conversations with at least 2 user messages, then reconstructs
 * the full conversation history (up to 20 messages per chat) including tool
 * names used during the conversation.
 *
 * RLS note: This query must run as the DB owner (not app_user)
 * since the evals service needs cross-user read access.
 */
export async function sampleMultiTurnChats(): Promise<MultiTurnChatSample[]> {
  const { sampleSize, lookbackHours } = config

  const rows = await withRetry(
    () =>
      db.execute<{
        chat_id: string
        created_at: Date
        conversation: string
        tool_names: string | null
        search_results: string | null
        citations: string | null
      }>(sql`
    WITH recent_chats AS (
      SELECT c.id, c.created_at
      FROM chats c
      WHERE c.created_at > NOW() - make_interval(hours => ${lookbackHours})
        AND (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.chat_id = c.id AND m.role = 'user'
        ) >= 2
      ORDER BY RANDOM()
      LIMIT ${sampleSize}
    ),
    ranked_messages AS (
      SELECT
        m.id AS message_id,
        m.chat_id,
        m.role,
        m.created_at,
        ROW_NUMBER() OVER (PARTITION BY m.chat_id ORDER BY m.created_at ASC) AS rn
      FROM messages m
      WHERE m.chat_id IN (SELECT id FROM recent_chats)
        AND m.role IN ('user', 'assistant')
    ),
    capped_messages AS (
      SELECT message_id, chat_id, role, created_at
      FROM ranked_messages
      WHERE rn <= 20
    ),
    message_texts AS (
      SELECT
        cm.chat_id,
        cm.role,
        cm.created_at,
        STRING_AGG(p.text_text, E'\n' ORDER BY p."order" ASC) AS text
      FROM capped_messages cm
      JOIN parts p ON p.message_id = cm.message_id
      WHERE p.type = 'text' AND p.text_text IS NOT NULL
      GROUP BY cm.chat_id, cm.message_id, cm.role, cm.created_at
    ),
    conversation_data AS (
      SELECT
        chat_id,
        json_agg(
          json_build_object('role', role, 'text', text)
          ORDER BY created_at ASC
        ) AS conversation
      FROM message_texts
      WHERE text IS NOT NULL
      GROUP BY chat_id
    ),
    tool_data AS (
      SELECT
        cm.chat_id,
        json_agg(DISTINCT p.tool_name) FILTER (WHERE p.tool_name IS NOT NULL) AS tool_names
      FROM capped_messages cm
      JOIN parts p ON p.message_id = cm.message_id
      WHERE p.type = 'tool-invocation'
      GROUP BY cm.chat_id
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
    )
    SELECT
      rc.id AS chat_id,
      rc.created_at,
      cd.conversation::text,
      td.tool_names::text,
      sd.search_results::text,
      ctd.citations::text
    FROM recent_chats rc
    JOIN conversation_data cd ON cd.chat_id = rc.id
    LEFT JOIN tool_data td ON td.chat_id = rc.id
    LEFT JOIN search_data sd ON sd.chat_id = rc.id
    LEFT JOIN citation_data ctd ON ctd.chat_id = rc.id
  `),
    { maxAttempts: 3, baseDelayMs: 2000 }
  )

  return rows.map(row => ({
    chatId: row.chat_id,
    createdAt: row.created_at,
    conversation: parseConversation(row.conversation),
    toolNames: parseToolNames(row.tool_names),
    searchResults: parseSearchResults(row.search_results),
    citations: parseCitations(row.citations)
  }))
}

function parseConversation(raw: string): MultiTurnChatSample['conversation'] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((turn: any) => ({
      role: turn?.role === 'user' ? 'user' : 'assistant',
      text: turn?.text ?? ''
    }))
  } catch (err) {
    console.warn('[evals] Failed to parse conversation JSON:', err)
    return []
  }
}

function parseToolNames(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (name: unknown): name is string =>
        typeof name === 'string' && name.length > 0
    )
  } catch (err) {
    console.warn('[evals] Failed to parse tool names JSON:', err)
    return []
  }
}

function parseCitations(raw: string | null): ChatSample['citations'] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((c: any) => ({
      url: c?.url ?? '',
      title: c?.title ?? ''
    }))
  } catch (err) {
    console.warn('[evals] Failed to parse citations JSON:', err)
    return []
  }
}

function parseSearchResults(raw: string | null): ChatSample['searchResults'] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((result: any) => ({
      query: result?.query ?? '',
      results: Array.isArray(result?.results)
        ? result.results.map((r: any) => ({
            title: r?.title ?? '',
            url: r?.url ?? '',
            snippet: r?.snippet ?? r?.content ?? ''
          }))
        : []
    }))
  } catch (err) {
    console.warn('[evals] Failed to parse search results JSON:', err)
    return []
  }
}
