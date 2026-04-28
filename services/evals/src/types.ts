export type EvalSuite =
  | 'capability'
  | 'regression'
  | 'smoke'
  | 'traffic-monitor'

export type PersistedEvalSuite = Exclude<EvalSuite, 'smoke'>

export type SuiteRunStatus = 'passed' | 'threshold_breached'

export interface SuiteRunResult {
  suite: PersistedEvalSuite
  status: SuiteRunStatus
  passRate: number
  threshold: number
  failedEvaluators: string[]
  experimentName: string
  datasetName: string
  phoenixUrl: string | null
  totalCases: number
}

export type EvalRunMode =
  | 'capability'
  | 'regression'
  | 'traffic-monitor'
  | 'smoke'
  | 'all'

export type EvalSearchMode = 'chat' | 'research'
export type EvalUserMode = 'search' | 'research' | 'build'
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
  userMode?: EvalUserMode
  intent?: string
  modelType: EvalModelType
  tags: string[]
  requiresTextAnswer: boolean
  requiresCitations: boolean
  allowsInteractiveOnly: boolean
  expectsRefusal: boolean
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
  userMode?: EvalUserMode
  intent?: string
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
    expectsRefusal: boolean
  }
}
