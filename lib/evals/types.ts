export interface EvalTrendPoint {
  createdAt: string
  passRate: number
  overallScore: number
}

export interface EvalSummarySnapshot {
  id: string
  experimentName: string
  datasetName: string
  passRate: number
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

export type TrafficMonitorDashboardData = CapabilityDashboardData

export interface EvalsDashboardData {
  capability: CapabilityDashboardData
  trafficMonitor: TrafficMonitorDashboardData
}

export interface EvalSummaryRow {
  id: string
  experimentName: string
  datasetName: string
  passRateBps: number
  evaluatorScores: Record<string, number>
  totalCases: number
  phoenixUrl: string | null
  createdAt: Date
}
