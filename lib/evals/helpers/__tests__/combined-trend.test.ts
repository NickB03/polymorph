import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { buildCombinedTrend } from '../combined-trend'

function emptySnapshot(): EvalsDashboardData {
  return {
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
}

describe('buildCombinedTrend', () => {
  it('unions timestamps across both suites', () => {
    const data = emptySnapshot()
    data.capability.trend = [
      { createdAt: '2026-04-01T00:00:00Z', overallScore: 0.9, passRate: 0.9 }
    ]
    data.trafficMonitor.trend = [
      { createdAt: '2026-04-02T00:00:00Z', overallScore: 0.7, passRate: 0.7 }
    ]
    const result = buildCombinedTrend(data)
    expect(result).toEqual([
      {
        createdAt: '2026-04-01T00:00:00Z',
        capability: 0.9,
        regression: null,
        trafficMonitor: null
      },
      {
        createdAt: '2026-04-02T00:00:00Z',
        capability: null,
        regression: null,
        trafficMonitor: 0.7
      }
    ])
  })

  it('combines entries on the same timestamp', () => {
    const data = emptySnapshot()
    const t = '2026-04-01T00:00:00Z'
    data.capability.trend = [{ createdAt: t, overallScore: 0.9, passRate: 0.9 }]
    data.trafficMonitor.trend = [
      { createdAt: t, overallScore: 0.7, passRate: 0.7 }
    ]
    const result = buildCombinedTrend(data)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      createdAt: t,
      capability: 0.9,
      regression: null,
      trafficMonitor: 0.7
    })
  })

  it('sorts by createdAt ascending', () => {
    const data = emptySnapshot()
    data.capability.trend = [
      { createdAt: '2026-04-03T00:00:00Z', overallScore: 0.9, passRate: 0.9 },
      { createdAt: '2026-04-01T00:00:00Z', overallScore: 0.85, passRate: 0.85 }
    ]
    const result = buildCombinedTrend(data)
    expect(result.map(r => r.createdAt)).toEqual([
      '2026-04-01T00:00:00Z',
      '2026-04-03T00:00:00Z'
    ])
  })

  it('includes regression as a third series in combined trend points', () => {
    const data = emptySnapshot()
    const t = '2026-04-22T00:00:00Z'
    data.capability.trend = [{ createdAt: t, overallScore: 0.9, passRate: 0.9 }]
    data.regression.trend = [
      { createdAt: t, overallScore: 0.85, passRate: 0.85 }
    ]
    data.trafficMonitor.trend = [
      { createdAt: t, overallScore: 0.8, passRate: 0.8 }
    ]

    const result = buildCombinedTrend(data)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      createdAt: t,
      capability: 0.9,
      regression: 0.85,
      trafficMonitor: 0.8
    })
  })

  it('leaves regression null when only capability and trafficMonitor have data at a timestamp', () => {
    const data = emptySnapshot()
    const t = '2026-04-22T00:00:00Z'
    data.capability.trend = [{ createdAt: t, overallScore: 0.9, passRate: 0.9 }]
    data.trafficMonitor.trend = [
      { createdAt: t, overallScore: 0.8, passRate: 0.8 }
    ]

    const result = buildCombinedTrend(data)

    expect(result[0].regression).toBe(null)
  })
})
