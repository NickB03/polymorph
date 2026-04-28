import { sql } from 'drizzle-orm'

import { config } from './config'
import { db } from './db'
import { getErrorMessage } from './error'
import { withRetry } from './retry'
import type {
  EvalCitation,
  EvalConversationMessage,
  EvalModelType,
  EvalSearchMode,
  EvalSearchResult,
  EvalUserMode
} from './types'

export class SamplerParseError extends Error {
  constructor(field: string, chatId: string, cause: unknown) {
    super(
      `SamplerParseError: Failed to parse ${field} for chat ${chatId}: ${getErrorMessage(cause)}`
    )
    this.name = 'SamplerParseError'
  }
}

export interface ChatSample {
  chatId: string
  createdAt: Date
  targetUserMessageId: string
  targetAssistantMessageId: string
  userQuery: string
  conversation: EvalConversationMessage[]
  searchMode: EvalSearchMode
  userMode?: EvalUserMode
  intent?: string
  modelType: EvalModelType
  originalModelId?: string
  metadataTags: string[]
  searchResults: EvalSearchResult[]
  modelAnswer: string
  citations: EvalCitation[]
  toolNames: string[]
}

interface SampleMessageRow {
  id?: unknown
  role?: unknown
  createdAt?: unknown
  uiMessage?: unknown
  metadata?: unknown
  textParts?: unknown
}

interface ChatSampleRow extends Record<string, unknown> {
  chat_id: string
  created_at: Date
  target_user_message_id: string
  target_assistant_message_id: string
  conversation_messages: unknown
  target_assistant_message: unknown
  target_search_results: unknown
  target_citations: unknown
  target_tool_names: unknown
}

/**
 * Sample recent chats from Supabase Postgres for evaluation.
 *
 * Samples coherent target turns from recent chats for evaluation.
 *
 * The canonical source is messages.ui_message. Legacy parts are only used when
 * ui_message is unavailable, matching the app's chat-load behavior.
 *
 * RLS note: This query must run as the DB owner (not app_user)
 * since the evals service needs cross-user read access.
 */
export async function sampleRecentChats(): Promise<ChatSample[]> {
  const { sampleSize, lookbackHours } = config

  // Raw SQL keeps the turn-level reconstruction in one query: pick the latest
  // assistant message with a preceding user turn per chat, then sample eligible
  // targets and return only conversation messages up to that user turn.
  const rows = await withRetry(
    () =>
      db.execute<ChatSampleRow>(sql`
    WITH target_turns AS (
      SELECT DISTINCT ON (assistant.chat_id)
        assistant.chat_id,
        assistant.id AS target_assistant_message_id,
        assistant.created_at AS assistant_created_at,
        assistant.ui_message AS assistant_ui_message,
        assistant.metadata AS assistant_metadata,
        target_user.id AS target_user_message_id,
        target_user.created_at AS user_created_at
      FROM messages assistant
      JOIN LATERAL (
        SELECT user_message.id, user_message.created_at
        FROM messages user_message
        WHERE user_message.chat_id = assistant.chat_id
          AND user_message.role = 'user'
          AND user_message.created_at < assistant.created_at
          AND (
            user_message.ui_message IS NOT NULL OR EXISTS (
              SELECT 1
              FROM parts user_part
              WHERE user_part.message_id = user_message.id
                AND user_part.type = 'text'
                AND user_part.text_text IS NOT NULL
            )
          )
        ORDER BY user_message.created_at DESC, user_message.id DESC
        LIMIT 1
      ) target_user ON true
      WHERE assistant.role = 'assistant'
        AND assistant.created_at > NOW() - make_interval(hours => ${lookbackHours})
        AND (
          assistant.ui_message IS NOT NULL OR EXISTS (
            SELECT 1
            FROM parts assistant_part
            WHERE assistant_part.message_id = assistant.id
              AND assistant_part.type = 'text'
              AND assistant_part.text_text IS NOT NULL
          )
        )
      ORDER BY assistant.chat_id, assistant.created_at DESC, assistant.id DESC
    ),
    sampled_targets AS (
      SELECT *
      FROM target_turns
      ORDER BY RANDOM()
      LIMIT ${sampleSize}
    )
    SELECT
      sampled.chat_id,
      sampled.assistant_created_at AS created_at,
      sampled.target_user_message_id,
      sampled.target_assistant_message_id,
      (
        SELECT json_agg(
          json_build_object(
            'id', conversation_message.id,
            'role', conversation_message.role,
            'createdAt', conversation_message.created_at,
            'uiMessage', conversation_message.ui_message,
            'metadata', conversation_message.metadata,
            'textParts', COALESCE(
              (
                SELECT json_agg(
                  json_build_object('type', 'text', 'text', text_part.text_text)
                  ORDER BY text_part."order"
                )
                FROM parts text_part
                WHERE text_part.message_id = conversation_message.id
                  AND text_part.type = 'text'
                  AND text_part.text_text IS NOT NULL
              ),
              '[]'::json
            )
          )
          ORDER BY conversation_message.created_at, conversation_message.id
        )
        FROM messages conversation_message
        WHERE conversation_message.chat_id = sampled.chat_id
          AND conversation_message.created_at <= sampled.user_created_at
      ) AS conversation_messages,
      json_build_object(
        'id', assistant_message.id,
        'role', assistant_message.role,
        'createdAt', assistant_message.created_at,
        'uiMessage', assistant_message.ui_message,
        'metadata', assistant_message.metadata,
        'textParts', COALESCE(
          (
            SELECT json_agg(
              json_build_object('type', 'text', 'text', text_part.text_text)
              ORDER BY text_part."order"
            )
            FROM parts text_part
            WHERE text_part.message_id = assistant_message.id
              AND text_part.type = 'text'
              AND text_part.text_text IS NOT NULL
          ),
          '[]'::json
        )
      ) AS target_assistant_message,
      (
        SELECT json_agg(search_part.tool_search_output)
        FROM parts search_part
        WHERE search_part.message_id = sampled.target_assistant_message_id
          AND search_part.type = 'tool-search'
          AND search_part.tool_state = 'output-available'
          AND search_part.tool_search_output IS NOT NULL
      ) AS target_search_results,
      (
        SELECT json_agg(json_build_object(
          'url', citation_part.source_url_url,
          'title', citation_part.source_url_title
        ))
        FROM parts citation_part
        WHERE citation_part.message_id = sampled.target_assistant_message_id
          AND citation_part.type = 'source-url'
      ) AS target_citations,
      (
        SELECT json_agg(DISTINCT COALESCE(tool_part.tool_dynamic_name, substring(tool_part.type from 6)))
        FROM parts tool_part
        WHERE tool_part.message_id = sampled.target_assistant_message_id
          AND tool_part.type LIKE 'tool-%'
      ) AS target_tool_names
    FROM sampled_targets sampled
    JOIN messages assistant_message
      ON assistant_message.id = sampled.target_assistant_message_id
  `),
    { maxAttempts: 3, baseDelayMs: 2000 }
  )

  const samples: ChatSample[] = []
  let parseFailures = 0

  for (const row of rows) {
    try {
      samples.push(mapRowToSample(row))
    } catch (err) {
      parseFailures++
      console.warn(
        `[evals] Skipping chat ${row.chat_id} due to parse error:`,
        getErrorMessage(err)
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function parseJsonArray(raw: unknown, field: string): unknown[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (err) {
    throw new SamplerParseError(field, 'unknown', err)
  }
}

function messageParts(message: SampleMessageRow): unknown[] {
  const uiMessage = asRecord(message.uiMessage)
  const uiParts = uiMessage?.parts

  if (Array.isArray(uiParts)) {
    return uiParts
  }

  return parseJsonArray(message.textParts, 'text_parts')
}

function metadataFor(message: SampleMessageRow): Record<string, unknown> {
  const uiMessage = asRecord(message.uiMessage)
  return {
    ...(asRecord(uiMessage?.metadata) ?? {}),
    ...(asRecord(message.metadata) ?? {})
  }
}

function partText(part: unknown): string | null {
  const record = asRecord(part)
  if (record?.type !== 'text') return null
  return typeof record.text === 'string' ? record.text : null
}

function textFromMessage(message: SampleMessageRow): string {
  return messageParts(message)
    .map(partText)
    .filter((text): text is string => typeof text === 'string')
    .join('')
    .trim()
}

function conversationMessageFromRow(
  message: SampleMessageRow
): EvalConversationMessage | null {
  const role =
    message.role === 'user' || message.role === 'assistant'
      ? message.role
      : null
  if (!role) return null

  const text = textFromMessage(message)
  if (!text) return null

  return {
    role,
    parts: [{ type: 'text', text }]
  }
}

function normalizeSearchResultOutput(output: unknown): EvalSearchResult | null {
  const record = asRecord(output)
  if (!record) return null

  return {
    query: String(record.query ?? ''),
    results: Array.isArray(record.results)
      ? (record.results as unknown[]).map(result => {
          const resultRecord = asRecord(result) ?? {}
          return {
            title: String(resultRecord.title ?? ''),
            url: String(resultRecord.url ?? ''),
            snippet: String(resultRecord.snippet ?? resultRecord.content ?? '')
          }
        })
      : []
  }
}

function citationsFromSearchOutput(output: unknown): EvalCitation[] {
  const record = asRecord(output)
  if (!record) return []

  const citationMap = asRecord(record.citationMap)
  if (citationMap) {
    return Object.values(citationMap).map(citation => {
      const citationRecord = asRecord(citation) ?? {}
      return {
        title: String(citationRecord.title ?? ''),
        url: String(citationRecord.url ?? '')
      }
    })
  }

  if (!Array.isArray(record.results)) {
    return []
  }

  return record.results.map(result => {
    const resultRecord = asRecord(result) ?? {}
    return {
      title: String(resultRecord.title ?? ''),
      url: String(resultRecord.url ?? '')
    }
  })
}

function dedupeCitations(citations: EvalCitation[]): EvalCitation[] {
  const seen = new Set<string>()
  return citations.filter(citation => {
    const key = `${citation.url}::${citation.title}`
    if (!citation.url || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function searchResultsFromMessage(
  message: SampleMessageRow
): EvalSearchResult[] {
  return messageParts(message)
    .filter(part => asRecord(part)?.type === 'tool-search')
    .map(part => normalizeSearchResultOutput(asRecord(part)?.output))
    .filter((result): result is EvalSearchResult => result !== null)
}

function citationsFromMessage(message: SampleMessageRow): EvalCitation[] {
  const citations: EvalCitation[] = []

  for (const part of messageParts(message)) {
    const record = asRecord(part)
    if (!record) continue

    if (record.type === 'tool-search') {
      citations.push(...citationsFromSearchOutput(record.output))
      continue
    }

    if (record.type === 'tool-displayCitations') {
      const output = asRecord(record.output)
      const outputCitations = Array.isArray(output?.citations)
        ? output.citations
        : []
      citations.push(
        ...outputCitations.map(citation => {
          const citationRecord = asRecord(citation) ?? {}
          return {
            title: String(citationRecord.title ?? ''),
            url: String(citationRecord.href ?? citationRecord.url ?? '')
          }
        })
      )
      continue
    }

    if (record.type === 'source-url') {
      citations.push({
        title: String(record.title ?? ''),
        url: String(record.url ?? '')
      })
    }
  }

  return dedupeCitations(citations)
}

function toolNamesFromMessage(message: SampleMessageRow): string[] {
  return dedupeStrings(
    messageParts(message)
      .map(part => {
        const record = asRecord(part)
        const type = typeof record?.type === 'string' ? record.type : ''
        return type.startsWith('tool-') ? type.slice(5) : ''
      })
      .filter(Boolean)
  )
}

function isSearchMode(value: unknown): value is EvalSearchMode {
  return value === 'chat' || value === 'research'
}

function isUserMode(value: unknown): value is EvalUserMode {
  return value === 'search' || value === 'research' || value === 'build'
}

function isModelType(value: unknown): value is EvalModelType {
  return value === 'speed' || value === 'quality'
}

function mapRowToSample(row: ChatSampleRow): ChatSample {
  const conversationRows = parseJsonArray(
    row.conversation_messages,
    'conversation_messages'
  ) as SampleMessageRow[]
  const targetAssistant = asRecord(
    typeof row.target_assistant_message === 'string'
      ? JSON.parse(row.target_assistant_message)
      : row.target_assistant_message
  ) as SampleMessageRow | null

  if (!targetAssistant) {
    throw new SamplerParseError(
      'target_assistant_message',
      row.chat_id,
      new Error('missing target assistant message')
    )
  }

  const conversation = conversationRows
    .map(conversationMessageFromRow)
    .filter((message): message is EvalConversationMessage => message !== null)
  const latestUser = [...conversation]
    .reverse()
    .find(message => message.role === 'user')
  const userQuery =
    latestUser?.parts
      .map(part => part.text)
      .join(' ')
      .trim() ?? ''
  const modelAnswer = textFromMessage(targetAssistant)

  if (!userQuery || !modelAnswer) {
    throw new SamplerParseError(
      'conversation',
      row.chat_id,
      new Error('missing target user query or assistant answer')
    )
  }

  const userMessageRow =
    conversationRows.find(
      message => message.id === row.target_user_message_id
    ) ?? conversationRows[conversationRows.length - 1]
  const userMetadata = metadataFor(userMessageRow ?? {})
  const assistantMetadata = metadataFor(targetAssistant)
  const rawUserMode = isUserMode(userMetadata.userMode)
    ? userMetadata.userMode
    : isUserMode(assistantMetadata.userMode)
      ? assistantMetadata.userMode
      : undefined
  const rawIntent =
    typeof userMetadata.intent === 'string'
      ? userMetadata.intent
      : typeof assistantMetadata.intent === 'string'
        ? assistantMetadata.intent
        : undefined
  const intent = rawUserMode === 'build' ? 'build' : rawIntent
  const rawSearchMode = userMetadata.searchMode
  const searchMode = isSearchMode(rawSearchMode)
    ? rawSearchMode
    : rawUserMode === 'research'
      ? 'research'
      : 'chat'
  const modelType = isModelType(userMetadata.modelType)
    ? userMetadata.modelType
    : 'speed'
  const originalModelId =
    typeof userMetadata.modelId === 'string'
      ? userMetadata.modelId
      : typeof assistantMetadata.modelId === 'string'
        ? assistantMetadata.modelId
        : undefined
  const metadataTags = rawUserMode
    ? [`user-mode:${rawUserMode}`]
    : ['mode_metadata_missing']

  return {
    chatId: row.chat_id,
    createdAt: row.created_at,
    targetUserMessageId: row.target_user_message_id,
    targetAssistantMessageId: row.target_assistant_message_id,
    userQuery,
    conversation,
    searchMode,
    ...(rawUserMode ? { userMode: rawUserMode } : {}),
    ...(intent ? { intent } : {}),
    modelType,
    ...(originalModelId ? { originalModelId } : {}),
    metadataTags,
    searchResults: searchResultsFromMessage(targetAssistant).concat(
      parseSearchResults(row.target_search_results)
    ),
    modelAnswer,
    citations: dedupeCitations([
      ...citationsFromMessage(targetAssistant),
      ...parseCitations(row.target_citations)
    ]),
    toolNames: dedupeStrings([
      ...toolNamesFromMessage(targetAssistant),
      ...parseToolNames(row.target_tool_names)
    ])
  }
}

export function parseToolNames(raw: unknown): string[] {
  try {
    const parsed = parseJsonArray(raw, 'tool_names')
    return parsed.filter(
      (name: unknown): name is string =>
        typeof name === 'string' && name.length > 0
    )
  } catch (err) {
    if (err instanceof SamplerParseError) throw err
    throw new SamplerParseError('tool_names', 'unknown', err)
  }
}

export function parseCitations(raw: unknown): EvalCitation[] {
  try {
    const parsed = parseJsonArray(raw, 'citations')
    return parsed
      .map(asRecord)
      .filter((c): c is Record<string, unknown> => c !== null)
      .map(c => ({
        url: String(c.url ?? ''),
        title: String(c.title ?? '')
      }))
  } catch (err) {
    if (err instanceof SamplerParseError) throw err
    throw new SamplerParseError('citations', 'unknown', err)
  }
}

export function parseSearchResults(raw: unknown): EvalSearchResult[] {
  try {
    const parsed = parseJsonArray(raw, 'search_results')
    return parsed
      .map(asRecord)
      .filter((result): result is Record<string, unknown> => result !== null)
      .map(result => ({
        query: String(result.query ?? ''),
        results: Array.isArray(result.results)
          ? result.results
              .map(asRecord)
              .filter((r): r is Record<string, unknown> => r !== null)
              .map(r => ({
                title: String(r.title ?? ''),
                url: String(r.url ?? ''),
                snippet: String(r.snippet ?? r.content ?? '')
              }))
          : []
      }))
  } catch (err) {
    if (err instanceof SamplerParseError) throw err
    throw new SamplerParseError('search_results', 'unknown', err)
  }
}
