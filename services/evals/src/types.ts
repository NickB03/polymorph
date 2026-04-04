export type EvalSuite =
  | 'capability'
  | 'regression'
  | 'smoke'
  | 'traffic-monitor'

export type EvalRunMode =
  | 'capability'
  | 'regression'
  | 'traffic-monitor'
  | 'smoke'
  | 'all'

export type EvalSearchMode = 'chat' | 'research'
export type EvalModelType = 'speed' | 'quality'

export interface EvalConversationPart {
  type: 'text'
  text: string
}

export interface EvalConversationMessage {
  role: 'user' | 'assistant'
  parts: EvalConversationPart[]
}

export interface EvalCase {
  id: string
  suite: EvalSuite
  conversation: EvalConversationMessage[]
  searchMode: EvalSearchMode
  modelType: EvalModelType
  tags: string[]
  requiresTextAnswer: boolean
  requiresCitations: boolean
  allowsInteractiveOnly: boolean
}

export interface EvalCitation {
  url: string
  title: string
}

export interface EvalSearchResultItem {
  title: string
  url: string
  snippet: string
}

export interface EvalSearchResult {
  query: string
  results: EvalSearchResultItem[]
}

export interface EvalRunResult {
  answerText: string
  citations: EvalCitation[]
  searchResults: EvalSearchResult[]
  toolNames: string[]
  usedInteractiveOnlyOutput: boolean
  modelId: string
  traceId?: string
  durationMs: number
}

export interface EvalDatasetInput {
  caseId: string
  suite: EvalSuite
  conversation: EvalConversationMessage[]
  searchMode: EvalSearchMode
  modelType: EvalModelType
  prompt: string
  query: string
  context: string
  tags: string[]
}

export interface EvalDatasetExample {
  input: EvalDatasetInput
  output: EvalRunResult
  metadata: {
    caseId: string
    suite: EvalSuite
    tags: string[]
    corpusVersion: string
    requiresTextAnswer: boolean
    requiresCitations: boolean
    allowsInteractiveOnly: boolean
  }
}
