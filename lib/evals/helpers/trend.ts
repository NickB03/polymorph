import type {
  EvalSummarySnapshot,
  PersistedDashboardSuite
} from '@/lib/evals/types'

const SUITE_ALIAS: Record<
  PersistedDashboardSuite,
  'capability' | 'trafficMonitor' | 'regression'
> = {
  capability: 'capability',
  'traffic-monitor': 'trafficMonitor',
  regression: 'regression'
}

export interface TrendPoint {
  createdAt: Date
  capability: number | null
  trafficMonitor: number | null
  regression: number | null
}

export function buildTrendSeries(
  snapshots: ReadonlyArray<EvalSummarySnapshot>
): TrendPoint[] {
  if (snapshots.length === 0) return []

  const byTimestamp = new Map<string, TrendPoint>()
  for (const snap of snapshots) {
    const key = snap.createdAt
    const existing =
      byTimestamp.get(key) ??
      ({
        createdAt: new Date(snap.createdAt),
        capability: null,
        trafficMonitor: null,
        regression: null
      } satisfies TrendPoint)
    existing[SUITE_ALIAS[snap.suite]] = Math.round(snap.overallScore * 100)
    byTimestamp.set(key, existing)
  }

  return [...byTimestamp.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
}
