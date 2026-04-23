import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  PersistedDashboardSuite
} from '@/lib/evals/types'

const SUITE_LABELS: Record<PersistedDashboardSuite, string> = {
  capability: 'Capability',
  regression: 'Regression',
  'traffic-monitor': 'Traffic Monitor'
}

export interface DashboardAlert {
  snapshotId: string
  suite: PersistedDashboardSuite
  suiteLabel: string
  experimentName: string
  datasetName: string
  passRate: number
  threshold: number
  failedEvaluators: string[]
  totalCases: number
  phoenixUrl: string | null
  createdAt: string
}

export function getSuiteLabel(suite: PersistedDashboardSuite) {
  return SUITE_LABELS[suite]
}

function getLatestSnapshots(data: EvalsDashboardData): EvalSummarySnapshot[] {
  return [
    data.capability.latest,
    data.regression.latest,
    data.trafficMonitor.latest
  ].filter((snapshot): snapshot is EvalSummarySnapshot => snapshot !== null)
}

export function buildThresholdAlerts(
  data: EvalsDashboardData
): DashboardAlert[] {
  return getLatestSnapshots(data)
    .filter(
      snapshot => snapshot.thresholdBreached && snapshot.threshold !== null
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(snapshot => ({
      snapshotId: snapshot.id,
      suite: snapshot.suite,
      suiteLabel: getSuiteLabel(snapshot.suite),
      experimentName: snapshot.experimentName,
      datasetName: snapshot.datasetName,
      passRate: snapshot.passRate,
      threshold: snapshot.threshold!,
      failedEvaluators: snapshot.failedEvaluators,
      totalCases: snapshot.totalCases,
      phoenixUrl: snapshot.phoenixUrl,
      createdAt: snapshot.createdAt
    }))
}

export function getLatestThresholdAlert(data: EvalsDashboardData) {
  return buildThresholdAlerts(data)[0] ?? null
}
