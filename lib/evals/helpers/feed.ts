import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

// Stable synthetic slot ids. Do NOT use the underlying DB cuid.
// The `activity-feed` widget resolves TEMPLATE_C's
// `expandedByDefault: 'worst-drop-or-latest'` sentinel by first looking up
// a drop finding's `snapshotId`, then finding the matching FeedRow. Stable
// synthetic slot ids make that resolution ergonomic to test, debug, and
// target with `data-feed-row-id` attributes in smoke tests.
export const FEED_ROW_IDS = {
  CAPABILITY_LATEST: 'cap-latest',
  CAPABILITY_PREVIOUS: 'cap-prev',
  TRAFFIC_LATEST: 'traf-latest',
  TRAFFIC_PREVIOUS: 'traf-prev'
} as const

export type FeedRowId = (typeof FEED_ROW_IDS)[keyof typeof FEED_ROW_IDS]

export interface FeedRow {
  id: FeedRowId
  suite: 'capability' | 'trafficMonitor'
  suiteLabel: string
  createdAt: string
  overallScore: number
  passRate: number
  overallDelta: number | null
  snapshot: EvalSummarySnapshot
}

function computeDelta(latest?: number | null, previous?: number | null) {
  if (latest == null || previous == null) return null
  return latest - previous
}

export function buildFeed(data: EvalsDashboardData): FeedRow[] {
  const rows: FeedRow[] = []
  const { capability, trafficMonitor } = data

  if (capability.latest) {
    rows.push({
      id: FEED_ROW_IDS.CAPABILITY_LATEST,
      suite: 'capability',
      suiteLabel: 'Capability',
      createdAt: capability.latest.createdAt,
      overallScore: capability.latest.overallScore,
      passRate: capability.latest.passRate,
      overallDelta: computeDelta(
        capability.latest.overallScore,
        capability.previous?.overallScore
      ),
      snapshot: capability.latest
    })
  }
  if (capability.previous) {
    rows.push({
      id: FEED_ROW_IDS.CAPABILITY_PREVIOUS,
      suite: 'capability',
      suiteLabel: 'Capability',
      createdAt: capability.previous.createdAt,
      overallScore: capability.previous.overallScore,
      passRate: capability.previous.passRate,
      overallDelta: null,
      snapshot: capability.previous
    })
  }
  if (trafficMonitor.latest) {
    rows.push({
      id: FEED_ROW_IDS.TRAFFIC_LATEST,
      suite: 'trafficMonitor',
      suiteLabel: 'Traffic Monitor',
      createdAt: trafficMonitor.latest.createdAt,
      overallScore: trafficMonitor.latest.overallScore,
      passRate: trafficMonitor.latest.passRate,
      overallDelta: computeDelta(
        trafficMonitor.latest.overallScore,
        trafficMonitor.previous?.overallScore
      ),
      snapshot: trafficMonitor.latest
    })
  }
  if (trafficMonitor.previous) {
    rows.push({
      id: FEED_ROW_IDS.TRAFFIC_PREVIOUS,
      suite: 'trafficMonitor',
      suiteLabel: 'Traffic Monitor',
      createdAt: trafficMonitor.previous.createdAt,
      overallScore: trafficMonitor.previous.overallScore,
      passRate: trafficMonitor.previous.passRate,
      overallDelta: null,
      snapshot: trafficMonitor.previous
    })
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
