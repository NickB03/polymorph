export type PersistedDashboardSuite =
  | 'capability'
  | 'regression'
  | 'traffic-monitor'

export interface EvalTrendPoint {
  createdAt: string
  passRate: number
  overallScore: number
}

export type EvalFailureMode =
  | 'retrieval_miss'
  | 'bad_citation'
  | 'unsafe_response'
  | 'tool_not_called'
  | 'tool_unnecessary'
  | 'answer_incomplete'
  | 'contradicts_context'
  | 'other'

export interface EvalCaseResultSnapshot {
  id: string
  evalSummaryId: string
  suite: PersistedDashboardSuite
  experimentName: string
  experimentRunId: string
  datasetExampleId: string | null
  caseId: string
  evaluatorName: string
  annotatorKind: string | null
  score: number | null
  label: string | null
  explanation: string | null
  error: string | null
  failed: boolean
  failureMode: EvalFailureMode
  appModelId: string | null
  modelType: string | null
  searchMode: string | null
  correlationId: string | null
  otelTraceId: string | null
  evaluatorTraceId: string | null
  phoenixUrl: string | null
  createdAt: string
}

export interface EvalSummarySnapshot {
  id: string
  suite: PersistedDashboardSuite
  experimentName: string
  datasetName: string
  passRate: number
  threshold: number | null
  thresholdBreached: boolean
  failedEvaluators: string[]
  overallScore: number
  evaluatorScores: Record<string, number | null>
  totalCases: number
  attemptedCases: number
  failedCases: number
  dropRate: number
  appModelIds?: string[]
  primaryAppModelId?: string | null
  judgeProvider?: string
  judgeModel?: string | null
  judgeBaseUrl?: string | null
  judgeSettings?: Record<string, unknown>
  corpusVersion?: string | null
  datasetVersion?: string | null
  evaluatorTemplateVersion?: string
  appGitSha?: string | null
  sampleSize?: number | null
  lookbackHours?: number | null
  phoenixUrl: string | null
  createdAt: string
  caseResults?: EvalCaseResultSnapshot[]
}

export interface CapabilityDashboardData {
  latest: EvalSummarySnapshot | null
  previous: EvalSummarySnapshot | null
  trend: EvalTrendPoint[]
  lastUpdated: string | null
}

export type RegressionDashboardData = CapabilityDashboardData
export type TrafficMonitorDashboardData = CapabilityDashboardData

export interface EvalsDashboardData {
  capability: CapabilityDashboardData
  regression: RegressionDashboardData
  trafficMonitor: TrafficMonitorDashboardData
  recentRuns: EvalSummarySnapshot[]
}

export interface EvalSummaryRow {
  id: string
  suite: PersistedDashboardSuite
  experimentName: string
  datasetName: string
  passRateBps: number
  thresholdBps: number | null
  thresholdBreached: boolean
  failedEvaluators: string[]
  evaluatorScores: Record<string, number | null>
  totalCases: number
  attemptedCases: number
  failedCases: number
  appModelIds?: string[]
  primaryAppModelId?: string | null
  judgeProvider?: string
  judgeModel?: string | null
  judgeBaseUrl?: string | null
  judgeSettings?: Record<string, unknown>
  corpusVersion?: string | null
  datasetVersion?: string | null
  evaluatorTemplateVersion?: string
  appGitSha?: string | null
  sampleSize?: number | null
  lookbackHours?: number | null
  phoenixUrl: string | null
  createdAt: Date
}

export interface EvalCaseResultRow {
  id: string
  evalSummaryId: string
  suite: PersistedDashboardSuite
  experimentName: string
  experimentRunId: string
  datasetExampleId: string | null
  caseId: string
  evaluatorName: string
  annotatorKind: string | null
  scoreBps: number | null
  label: string | null
  explanation: string | null
  error: string | null
  failed: boolean
  failureMode: EvalFailureMode
  appModelId: string | null
  modelType: string | null
  searchMode: string | null
  correlationId: string | null
  otelTraceId: string | null
  evaluatorTraceId: string | null
  phoenixUrl: string | null
  createdAt: Date
}
