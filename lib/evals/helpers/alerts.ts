import { getSuiteLabel } from '@/lib/evals/display'
import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  PersistedDashboardSuite
} from '@/lib/evals/types'

const LEGACY_TRAFFIC_MONITOR_THRESHOLD = 0.8

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

function getLatestSnapshots(data: EvalsDashboardData): EvalSummarySnapshot[] {
  return [
    data.capability.latest,
    data.regression.latest,
    data.trafficMonitor.latest
  ].filter((snapshot): snapshot is EvalSummarySnapshot => snapshot !== null)
}

function getAlertThreshold(snapshot: EvalSummarySnapshot): number | null {
  if (snapshot.thresholdBreached && snapshot.threshold !== null) {
    return snapshot.threshold
  }

  // Pre-migration traffic-monitor summaries do not have threshold metadata.
  // Preserve the prior 80% dashboard alert behavior for those rows until
  // fresh runs rewrite them with per-run threshold data.
  if (
    snapshot.suite === 'traffic-monitor' &&
    snapshot.threshold === null &&
    snapshot.passRate < LEGACY_TRAFFIC_MONITOR_THRESHOLD
  ) {
    return LEGACY_TRAFFIC_MONITOR_THRESHOLD
  }

  return null
}

export function buildThresholdAlerts(
  data: EvalsDashboardData
): DashboardAlert[] {
  return getLatestSnapshots(data)
    .map(snapshot => ({ snapshot, threshold: getAlertThreshold(snapshot) }))
    .filter(
      (
        entry
      ): entry is {
        snapshot: EvalSummarySnapshot
        threshold: number
      } => entry.threshold !== null
    )
    .sort((left, right) =>
      right.snapshot.createdAt.localeCompare(left.snapshot.createdAt)
    )
    .map(({ snapshot, threshold }) => ({
      snapshotId: snapshot.id,
      suite: snapshot.suite,
      suiteLabel: getSuiteLabel(snapshot.suite),
      experimentName: snapshot.experimentName,
      datasetName: snapshot.datasetName,
      passRate: snapshot.passRate,
      threshold,
      failedEvaluators: snapshot.failedEvaluators,
      totalCases: snapshot.totalCases,
      phoenixUrl: snapshot.phoenixUrl,
      createdAt: snapshot.createdAt
    }))
}

export function getLatestThresholdAlert(data: EvalsDashboardData) {
  return buildThresholdAlerts(data)[0] ?? null
}
