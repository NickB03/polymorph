import type { EvalCitation, EvalRunResult, EvalSearchResult } from './types'

export interface EvalContextLike {
  searchResults: EvalSearchResult[]
  citations: EvalCitation[]
}

export function normalizeEvalRunResult(output: unknown): EvalRunResult {
  if (typeof output === 'string') {
    return {
      answerText: output,
      citations: [],
      searchResults: [],
      toolNames: [],
      usedInteractiveOnlyOutput: false,
      modelId: '',
      durationMs: 0
    }
  }

  if (!output || typeof output !== 'object') {
    return {
      answerText: '',
      citations: [],
      searchResults: [],
      toolNames: [],
      usedInteractiveOnlyOutput: false,
      modelId: '',
      durationMs: 0
    }
  }

  const value = output as Partial<EvalRunResult> & {
    answer?: string
  }
  const answerText = value.answerText ?? value.answer ?? ''
  const toolNames = Array.isArray(value.toolNames) ? value.toolNames : []
  const usedInteractiveOnlyOutput =
    typeof value.usedInteractiveOnlyOutput === 'boolean'
      ? value.usedInteractiveOnlyOutput
      : answerText.trim().length === 0 && toolNames.length > 0

  return {
    answerText,
    citations: Array.isArray(value.citations) ? value.citations : [],
    searchResults: Array.isArray(value.searchResults)
      ? value.searchResults
      : [],
    toolNames,
    usedInteractiveOnlyOutput,
    modelId: value.modelId ?? '',
    traceId: value.traceId,
    durationMs: typeof value.durationMs === 'number' ? value.durationMs : 0
  }
}

export function extractPromptFromConversation(
  conversation: Array<{
    role: 'user' | 'assistant'
    parts: Array<{ type: 'text'; text: string }>
  }>
): string {
  const lastUserMessage = [...conversation]
    .reverse()
    .find(message => message.role === 'user')

  if (!lastUserMessage) {
    return ''
  }

  return lastUserMessage.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ')
    .trim()
}

export function formatEvalContext({
  searchResults,
  citations
}: EvalContextLike): string {
  const parts: string[] = []

  for (const search of searchResults) {
    if (search.query) parts.push(`[Search: "${search.query}"]`)
    for (const result of search.results) {
      parts.push(`- ${result.title}: ${result.snippet}`)
    }
  }

  if (citations.length > 0) {
    parts.push('\n[Citations]')
    for (const citation of citations) {
      parts.push(`- ${citation.title} (${citation.url})`)
    }
  }

  return parts.join('\n')
}
