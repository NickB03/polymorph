import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { getOverallStatus, getSuiteStatus, type SuiteStatus } from './status'

const BASE: EvalSummarySnapshot = {
  id: 'x',
  suite: 'capability',
  experimentName: 'e',
  datasetName: 'd',
  passRate: 0.9,
  threshold: 0.85,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore: 0.9,
  evaluatorScores: { faithfulness: 0.9 },
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z'
}

describe('getSuiteStatus', () => {
  it('returns BLOCKED when thresholdBreached is true', () => {
    expect(
      getSuiteStatus({ ...BASE, thresholdBreached: true }, null)
    ).toBe<SuiteStatus>('BLOCKED')
  })

  it('returns WATCH when failedCases > 0 but threshold holds', () => {
    expect(getSuiteStatus({ ...BASE, failedCases: 1 }, null)).toBe('WATCH')
  })

  it('returns WATCH when failedEvaluators is non-empty', () => {
    expect(
      getSuiteStatus({ ...BASE, failedEvaluators: ['faithfulness'] }, null)
    ).toBe('WATCH')
  })

  it('returns WATCH on a >5pt evaluator drop vs previous', () => {
    const previous = { ...BASE, evaluatorScores: { faithfulness: 0.99 } }
    const current = { ...BASE, evaluatorScores: { faithfulness: 0.9 } }
    expect(getSuiteStatus(current, previous)).toBe('WATCH')
  })

  it('returns READY when nothing is wrong', () => {
    expect(getSuiteStatus(BASE, null)).toBe('READY')
  })
})

describe('getOverallStatus', () => {
  const SUITE = (status: SuiteStatus): EvalSummarySnapshot => {
    if (status === 'BLOCKED') return { ...BASE, thresholdBreached: true }
    if (status === 'WATCH') return { ...BASE, failedCases: 1 }
    return BASE
  }
  const DATA = (
    cap: SuiteStatus,
    traf: SuiteStatus,
    reg: SuiteStatus
  ): EvalsDashboardData => ({
    capability: {
      latest: SUITE(cap),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: SUITE(traf),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    regression: {
      latest: SUITE(reg),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    recentRuns: []
  })

  it('returns the worst of three suites', () => {
    expect(getOverallStatus(DATA('READY', 'WATCH', 'BLOCKED'))).toBe('BLOCKED')
    expect(getOverallStatus(DATA('READY', 'WATCH', 'READY'))).toBe('WATCH')
    expect(getOverallStatus(DATA('READY', 'READY', 'READY'))).toBe('READY')
  })

  it('returns READY when no suite has data', () => {
    const empty: EvalsDashboardData = {
      capability: {
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
      },
      regression: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      recentRuns: []
    }
    expect(getOverallStatus(empty)).toBe('READY')
  })
})
