import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { buildThresholdAlerts, getLatestThresholdAlert } from '../alerts'

function snapshot(
  suite: EvalSummarySnapshot['suite'],
  createdAt: string,
  thresholdBreached: boolean,
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot {
  return {
    id: `${suite}-${createdAt}`,
    suite,
    experimentName: `exp-${suite}`,
    datasetName: `ds-${suite}`,
    passRate: thresholdBreached ? 0.7 : 0.91,
    threshold: 0.8,
    thresholdBreached,
    failedEvaluators: thresholdBreached ? ['faithfulness'] : [],
    overallScore: 0.8,
    evaluatorScores: { faithfulness: 0.8 },
    totalCases: 10,
    attemptedCases: 10,
    failedCases: 0,
    dropRate: 0,
    phoenixUrl: null,
    createdAt,
    ...overrides
  }
}

function data(): EvalsDashboardData {
  return {
    capability: {
      latest: snapshot('capability', '2026-04-14T08:00:00Z', false),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    regression: {
      latest: snapshot('regression', '2026-04-14T10:00:00Z', true),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: snapshot('traffic-monitor', '2026-04-14T09:00:00Z', true),
      previous: null,
      trend: [],
      lastUpdated: null
    }
  }
}

describe('buildThresholdAlerts', () => {
  it('returns only threshold-breached latest runs newest-first', () => {
    const alerts = buildThresholdAlerts(data())

    expect(alerts.map(alert => alert.suite)).toEqual([
      'regression',
      'traffic-monitor'
    ])
  })

  it('returns the newest alert for the banner helper', () => {
    const alert = getLatestThresholdAlert(data())

    expect(alert?.suite).toBe('regression')
    expect(alert?.suiteLabel).toBe('Regression')
  })

  it('falls back to the legacy traffic-monitor threshold when metadata is missing', () => {
    const alerts = buildThresholdAlerts({
      capability: {
        latest: null,
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
        latest: snapshot('traffic-monitor', '2026-04-14T11:00:00Z', false, {
          passRate: 0.72,
          threshold: null
        }),
        previous: null,
        trend: [],
        lastUpdated: null
      }
    })

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      suite: 'traffic-monitor',
      threshold: 0.8,
      passRate: 0.72
    })
  })
})
