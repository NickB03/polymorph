import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import {
  getDefaultSuite,
  getFirstAvailableSuite,
  getPhoenixInsight
} from './attention'

const BASE_SNAPSHOT: EvalSummarySnapshot = {
  id: 'capability-latest',
  suite: 'capability',
  experimentName: 'eval-fixture',
  datasetName: 'fixture-dataset',
  passRate: 0.9,
  threshold: 0.85,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore: 0.88,
  evaluatorScores: { faithfulness: 0.9 },
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z'
}

const EMPTY: EvalsDashboardData = {
  capability: { latest: null, previous: null, trend: [], lastUpdated: null },
  regression: { latest: null, previous: null, trend: [], lastUpdated: null },
  trafficMonitor: {
    latest: null,
    previous: null,
    trend: [],
    lastUpdated: null
  },
  recentRuns: []
}

function snapshot(
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot {
  return {
    ...BASE_SNAPSHOT,
    ...overrides,
    evaluatorScores: overrides.evaluatorScores ?? BASE_SNAPSHOT.evaluatorScores,
    failedEvaluators:
      overrides.failedEvaluators ?? BASE_SNAPSHOT.failedEvaluators
  }
}

function data(overrides: Partial<EvalsDashboardData> = {}): EvalsDashboardData {
  return {
    ...EMPTY,
    ...overrides
  }
}

describe('eval dashboard attention helpers', () => {
  it('uses Test Suite as the first available default when there is no alert', () => {
    const capability = snapshot()
    const dashboardData = data({
      capability: {
        latest: capability,
        previous: null,
        trend: [],
        lastUpdated: capability.createdAt
      },
      recentRuns: [capability]
    })

    expect(getFirstAvailableSuite(dashboardData)).toBe('capability')
    expect(getDefaultSuite(dashboardData)).toBe('capability')
    expect(getPhoenixInsight(dashboardData)).toBeNull()
  })

  it('uses Production Evals as the default and emits WATCH copy when breach is shallow', () => {
    const capability = snapshot({
      id: 'capability-latest',
      suite: 'capability',
      datasetName: 'capability-dataset',
      thresholdBreached: false,
      passRate: 0.92
    })
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      datasetName: 'traffic-dataset',
      passRate: 0.78,
      threshold: 0.85,
      // Shallow gap (0.78 vs 0.85) — within BLOCKED_THRESHOLD_GAP, so WATCH.
      overallScore: 0.78,
      thresholdBreached: true,
      failedEvaluators: ['citation_accuracy'],
      phoenixUrl:
        'https://phoenix.example.com/datasets/traffic-dataset/compare?experimentId=traffic-experiment'
    })
    const dashboardData = data({
      capability: {
        latest: capability,
        previous: null,
        trend: [],
        lastUpdated: capability.createdAt
      },
      trafficMonitor: {
        latest: trafficMonitor,
        previous: null,
        trend: [],
        lastUpdated: trafficMonitor.createdAt
      },
      recentRuns: [trafficMonitor, capability]
    })

    const insight = getPhoenixInsight(dashboardData)

    expect(getDefaultSuite(dashboardData)).toBe('trafficMonitor')
    expect(insight?.suiteId).toBe('trafficMonitor')
    expect(insight?.summary).toBe('Traffic Monitor is below threshold.')
    expect(insight?.interpretation).toBe(
      'Threshold not breached — keeping at WATCH. Review the worst-failing cases below.'
    )
    expect(insight?.actionLabel).toBe('Review')
  })

  it('emits BLOCKED copy when regression guardrails fall well below threshold', () => {
    const capability = snapshot({
      id: 'capability-latest',
      suite: 'capability',
      thresholdBreached: false
    })
    const regression = snapshot({
      id: 'regression-latest',
      suite: 'regression',
      datasetName: 'regression-dataset',
      passRate: 0.7,
      threshold: 0.9,
      // Deep gap (0.7 vs 0.9) — exceeds BLOCKED_THRESHOLD_GAP, so BLOCKED.
      overallScore: 0.7,
      thresholdBreached: true,
      failedEvaluators: ['response_quality']
    })
    const dashboardData = data({
      capability: {
        latest: capability,
        previous: null,
        trend: [],
        lastUpdated: capability.createdAt
      },
      regression: {
        latest: regression,
        previous: null,
        trend: [],
        lastUpdated: regression.createdAt
      },
      recentRuns: [regression, capability]
    })

    const insight = getPhoenixInsight(dashboardData)

    expect(getDefaultSuite(dashboardData)).toBe('regression')
    expect(insight?.suiteId).toBe('regression')
    expect(insight?.summary).toBe('Regression Tests is below threshold.')
    expect(insight?.interpretation).toBe(
      'Threshold breached — review the worst-failing cases below.'
    )
  })
})
