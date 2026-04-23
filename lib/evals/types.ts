export type PersistedDashboardSuite =
  | 'capability'
  | 'regression'
  | 'traffic-monitor'

export interface EvalTrendPoint {
  createdAt: string
  passRate: number
  overallScore: number
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
  evaluatorScores: Record<string, number>
  totalCases: number
  phoenixUrl: string | null
  createdAt: string
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
  evaluatorScores: Record<string, number>
  totalCases: number
  phoenixUrl: string | null
  createdAt: Date
}
