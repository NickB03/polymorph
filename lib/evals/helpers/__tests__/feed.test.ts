import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { buildFeed, FEED_ROW_IDS } from '../feed'

function snap(
  dbId: string,
  createdAt: string,
  overallScore: number
): EvalSummarySnapshot {
  return {
    id: dbId,
    suite: 'capability',
    experimentName: dbId,
    datasetName: 'ds',
    passRate: 0.9,
    threshold: 0.8,
    thresholdBreached: false,
    failedEvaluators: [],
    overallScore,
    evaluatorScores: {},
    totalCases: 10,
    attemptedCases: 10,
    failedCases: 0,
    dropRate: 0,
    phoenixUrl: null,
    createdAt
  }
}

describe('buildFeed', () => {
  it('returns rows sorted by createdAt descending, using stable synthetic ids', () => {
    const data: EvalsDashboardData = {
      capability: {
        latest: snap('db-cuid-cap-latest', '2026-04-14T08:00:00Z', 0.95),
        previous: snap('db-cuid-cap-prev', '2026-04-12T08:00:00Z', 0.92),
        trend: [],
        lastUpdated: null
      },
      regression: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: {
          ...snap('db-cuid-traf-latest', '2026-04-14T09:00:00Z', 0.77),
          suite: 'traffic-monitor'
        },
        previous: {
          ...snap('db-cuid-traf-prev', '2026-04-14T03:00:00Z', 0.79),
          suite: 'traffic-monitor'
        },
        trend: [],
        lastUpdated: null
      }
    }
    const feed = buildFeed(data)
    // Row ids MUST be the stable synthetic constants, NOT the underlying DB cuids.
    // The `activity-feed` widget resolves TEMPLATE_C's `worst-drop-or-latest`
    // sentinel by looking up a finding's snapshotId, then finding the matching
    // FeedRow. Stable synthetic row.id values make that resolution ergonomic
    // to test, debug, and target via data-feed-row-id attributes.
    expect(feed.map(r => r.id)).toEqual([
      FEED_ROW_IDS.TRAFFIC_LATEST,
      FEED_ROW_IDS.CAPABILITY_LATEST,
      FEED_ROW_IDS.TRAFFIC_PREVIOUS,
      FEED_ROW_IDS.CAPABILITY_PREVIOUS
    ])
    expect(feed.map(r => r.id)).toEqual([
      'traf-latest',
      'cap-latest',
      'traf-prev',
      'cap-prev'
    ])
  })

  it('omits empty slots when only one suite has data', () => {
    const data: EvalsDashboardData = {
      capability: {
        latest: snap('db-cuid-cap-latest', '2026-04-14T08:00:00Z', 0.95),
        previous: null,
        trend: [],
        lastUpdated: null
      },
      regression: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      }
    }
    const feed = buildFeed(data)
    expect(feed).toHaveLength(1)
    expect(feed[0].id).toBe(FEED_ROW_IDS.CAPABILITY_LATEST)
  })

  it('computes overallDelta for latest against previous of same suite', () => {
    const data: EvalsDashboardData = {
      capability: {
        latest: snap('db-cuid-cap-latest', '2026-04-14T08:00:00Z', 0.95),
        previous: snap('db-cuid-cap-prev', '2026-04-12T08:00:00Z', 0.92),
        trend: [],
        lastUpdated: null
      },
      regression: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      }
    }
    const feed = buildFeed(data)
    expect(feed[0].overallDelta).toBeCloseTo(0.03, 5)
  })

  it('preserves access to the underlying DB snapshot via row.snapshot', () => {
    const latestSnap = snap('db-cuid-cap-latest', '2026-04-14T08:00:00Z', 0.95)
    const data: EvalsDashboardData = {
      capability: {
        latest: latestSnap,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      regression: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      }
    }
    const feed = buildFeed(data)
    expect(feed[0].snapshot).toBe(latestSnap)
    expect(feed[0].snapshot.id).toBe('db-cuid-cap-latest')
    // row.id ≠ snapshot.id — row.id is a synthetic slot id, snapshot.id is the DB cuid
    expect(feed[0].id).not.toBe(feed[0].snapshot.id)
  })
})
