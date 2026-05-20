import { describe, expect, it } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { buildTrendSeries } from './trend'

const snap = (
  suite: EvalSummarySnapshot['suite'],
  overallScore: number,
  createdAt: string
): EvalSummarySnapshot => ({
  id: `${suite}-${createdAt}`,
  suite,
  experimentName: 'x',
  datasetName: 'd',
  passRate: 0,
  threshold: null,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore,
  evaluatorScores: {},
  totalCases: 0,
  attemptedCases: 0,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt
})

describe('buildTrendSeries', () => {
  it('returns empty array for no input', () => {
    expect(buildTrendSeries([])).toEqual([])
  })

  it('joins snapshots from multiple suites on shared timestamps', () => {
    const points = buildTrendSeries([
      snap('capability', 0.9, '2026-05-19T10:00:00Z'),
      snap('regression', 0.8, '2026-05-19T10:00:00Z'),
      snap('capability', 0.85, '2026-05-19T11:00:00Z')
    ])

    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({
      capability: 90,
      regression: 80
    })
    expect(points[1]).toMatchObject({
      capability: 85
    })
    expect(points[1].regression).toBeNull()
  })

  it('sorts points chronologically', () => {
    const points = buildTrendSeries([
      snap('capability', 0.7, '2026-05-19T12:00:00Z'),
      snap('capability', 0.9, '2026-05-19T10:00:00Z')
    ])
    expect(points[0].createdAt.getTime()).toBeLessThan(
      points[1].createdAt.getTime()
    )
  })
})
