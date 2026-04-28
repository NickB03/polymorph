import { convertToModelMessages, pruneMessages, readUIMessageStream } from 'ai'
import { randomUUID } from 'crypto'

import { researcher } from '@/lib/agents/researcher'
import { stripReasoningParts } from '@/lib/streaming/helpers/strip-reasoning-parts'
import type { SearchResults } from '@/lib/types'
import type { UIMessage } from '@/lib/types/ai'
import type { ModelType } from '@/lib/types/model-type'
import type { Model } from '@/lib/types/models'
import type { SearchMode, UserMode } from '@/lib/types/search'
import { createModelId } from '@/lib/utils'
import { maybeTruncateMessages } from '@/lib/utils/context-window'
import { flushTraces, isTracingEnabled } from '@/lib/utils/telemetry'

type EvalSuite = 'capability' | 'regression' | 'smoke' | 'traffic-monitor'

export interface EvalChatRunInput {
  caseId: string
  suite: EvalSuite
  conversation: Array<{
    role: 'user' | 'assistant'
    parts: Array<{ type: 'text'; text: string }>
  }>
  searchMode: SearchMode
  userMode?: UserMode
  intent?: string
  modelType: ModelType
  model: Model
  abortSignal?: AbortSignal
}

export interface EvalChatRunResult {
  answerText: string
  citations: Array<{ url: string; title: string }>
  searchResults: Array<{
    query: string
    results: Array<{ title: string; url: string; snippet: string }>
  }>
  toolNames: string[]
  usedInteractiveOnlyOutput: boolean
  modelId: string
  traceId?: string
  durationMs: number
}

interface NormalizeEvalRunResultInput {
  finalMessage?: { parts?: unknown[] } | null
  modelId: string
  durationMs: number
  traceId?: string
}

function isTextPart(part: unknown): part is {
  type: 'text'
  text: string
} {
  return (
    typeof part === 'object' &&
    part !== null &&
    (part as { type?: string }).type === 'text' &&
    typeof (part as { text?: string }).text === 'string'
  )
}

function isToolOutputPart(part: unknown): part is {
  type: string
  output?: unknown
} {
  return (
    typeof part === 'object' &&
    part !== null &&
    typeof (part as { type?: string }).type === 'string' &&
    (part as { type: string }).type.startsWith('tool-')
  )
}

function normalizeSearchResults(output: SearchResults) {
  return [
    {
      query: output.query ?? '',
      results: Array.isArray(output.results)
        ? output.results.map(result => ({
            title: result?.title ?? '',
            url: result?.url ?? '',
            snippet: result?.content ?? ''
          }))
        : []
    }
  ]
}

function getCitationsFromSearchResults(output: SearchResults) {
  if (output.citationMap) {
    return Object.values(output.citationMap).map(citation => ({
      title: citation?.title ?? '',
      url: citation?.url ?? ''
    }))
  }

  if (!Array.isArray(output.results)) {
    return []
  }

  return output.results.map(result => ({
    title: result?.title ?? '',
    url: result?.url ?? ''
  }))
}

function dedupeCitations(citations: Array<{ url: string; title: string }>) {
  const seen = new Set<string>()

  return citations.filter(citation => {
    const key = `${citation.url}::${citation.title}`
    if (!citation.url || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function normalizeEvalRunResult({
  finalMessage,
  modelId,
  durationMs,
  traceId
}: NormalizeEvalRunResultInput): EvalChatRunResult {
  const parts = finalMessage?.parts ?? []
  const answerText = parts
    .filter(isTextPart)
    .map(part => part.text)
    .join('')

  const toolNames: string[] = []
  const searchResults: EvalChatRunResult['searchResults'] = []
  const citations: Array<{ url: string; title: string }> = []

  for (const part of parts) {
    if (!isToolOutputPart(part)) continue

    const toolName = part.type.slice(5)
    toolNames.push(toolName)

    if (part.type === 'tool-search' && part.output) {
      const output = part.output as SearchResults
      searchResults.push(...normalizeSearchResults(output))
      citations.push(...getCitationsFromSearchResults(output))
      continue
    }

    if (part.type === 'tool-displayCitations' && part.output) {
      const output = part.output as {
        citations?: Array<{ href?: string; title?: string }>
      }
      citations.push(
        ...(output.citations ?? []).map(citation => ({
          title: citation?.title ?? '',
          url: citation?.href ?? ''
        }))
      )
    }
  }

  return {
    answerText,
    citations: dedupeCitations(citations),
    searchResults,
    toolNames: Array.from(new Set(toolNames)),
    usedInteractiveOnlyOutput: !answerText.trim() && toolNames.length > 0,
    modelId,
    ...(traceId ? { traceId } : {}),
    durationMs
  }
}

export async function runEvalChat({
  caseId,
  suite,
  conversation,
  searchMode,
  userMode,
  intent,
  modelType,
  model,
  abortSignal
}: EvalChatRunInput): Promise<EvalChatRunResult> {
  const startTime = Date.now()
  const modelId = createModelId(model)
  const parentTraceId = isTracingEnabled() ? randomUUID() : undefined
  const uiMessages = conversation.map(message => ({
    id: randomUUID(),
    ...message
  })) as UIMessage[]
  const isOpenAI = modelId.startsWith('openai:')
  const messagesToConvert = isOpenAI
    ? stripReasoningParts(uiMessages)
    : uiMessages

  let modelMessages = await convertToModelMessages(messagesToConvert)
  modelMessages = pruneMessages({
    messages: modelMessages,
    reasoning: 'before-last-message',
    toolCalls: 'before-last-2-messages',
    emptyMessages: 'remove'
  })
  modelMessages = maybeTruncateMessages(modelMessages, model)

  const researchAgent = researcher({
    model: modelId,
    modelConfig: model,
    parentTraceId,
    searchMode,
    userMode,
    intent,
    modelType,
    telemetryEnabled: false,
    experimentalContext: { caseId, suite, executionMode: 'eval' }
  })

  const result = await researchAgent.stream({
    messages: modelMessages,
    abortSignal
  })

  let finalMessage: { parts?: unknown[] } | null = null
  for await (const uiMessage of readUIMessageStream({
    stream: result.toUIMessageStream()
  })) {
    finalMessage = uiMessage as { parts?: unknown[] }
  }

  await flushTraces()

  return normalizeEvalRunResult({
    finalMessage,
    modelId,
    ...(parentTraceId ? { traceId: parentTraceId } : {}),
    durationMs: Date.now() - startTime
  })
}
