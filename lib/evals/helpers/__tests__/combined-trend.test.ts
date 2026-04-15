import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { buildCombinedTrend } from '../combined-trend'

function emptySnapshot(): EvalsDashboardData {
  return {
    capability: { latest: null, previous: null, trend: [], lastUpdated: null },
    trafficMonitor: {
      latest: null,
      previous: null,
      trend: [],
      lastUpdated: null
    }
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
        trafficMonitor: null
      },
      {
        createdAt: '2026-04-02T00:00:00Z',
        capability: null,
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
})
