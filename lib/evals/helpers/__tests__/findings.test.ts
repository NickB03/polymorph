import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { computeFindings } from '../findings'

function snap(
  overrides: Partial<EvalSummarySnapshot> & {
    evaluatorScores: Record<string, number>
  }
): EvalSummarySnapshot {
  return {
    id: 'test',
    experimentName: 'x',
    datasetName: 'y',
    passRate: 0.9,
    overallScore: 0.9,
    totalCases: 10,
    phoenixUrl: null,
    createdAt: '2026-04-14T10:00:00Z',
    ...overrides
  }
}

function data(
  capLatest: Record<string, number>,
  capPrev: Record<string, number>,
  trafLatest: Record<string, number>,
  trafPrev: Record<string, number>,
  trafPassRate = 0.9
): EvalsDashboardData {
  return {
    capability: {
      latest: snap({ id: 'cap-l', evaluatorScores: capLatest }),
      previous: snap({ id: 'cap-p', evaluatorScores: capPrev }),
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: snap({
        id: 'traf-l',
        evaluatorScores: trafLatest,
        passRate: trafPassRate
      }),
      previous: snap({ id: 'traf-p', evaluatorScores: trafPrev }),
      trend: [],
      lastUpdated: null
    }
  }
}

describe('computeFindings', () => {
  it('emits a drop finding when an evaluator loses >= 5pts on traffic', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.8 },
        { faithfulness: 0.9 }
      )
    )
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('drop')
    expect(result[0].text).toContain('Faithfulness')
    expect(result[0].text).toContain('dropped')
  })

  it('emits an improvement finding when an evaluator gains >= 5pts', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.95 },
        { faithfulness: 0.8 }
      )
    )
    expect(result[0].severity).toBe('improvement')
    expect(result[0].text).toContain('improved')
  })

  it('emits a critical finding when traffic pass rate < 80%', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        0.72
      )
    )
    expect(result.some(f => f.severity === 'critical')).toBe(true)
  })

  it('ignores deltas below 5pts', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.89 },
        { faithfulness: 0.9 }
      )
    )
    expect(result).toEqual([])
  })

  it('sorts by severity: critical > drop > improvement', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.95, relevance: 0.5 },
        { faithfulness: 0.8, relevance: 0.6 },
        0.72
      )
    )
    expect(result[0].severity).toBe('critical')
    expect(result.map(f => f.severity)).toContain('drop')
    expect(result.map(f => f.severity)).toContain('improvement')
  })

  it('attaches snapshotId so downstream consumers can correlate findings to rows', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.95 }, // +5pts on capability → improvement
        { faithfulness: 0.9 },
        { faithfulness: 0.8 }, // -10pts on traffic → drop
        { faithfulness: 0.9 },
        0.72 // below floor → critical
      )
    )
    const critical = result.find(f => f.severity === 'critical')
    const trafficDrop = result.find(
      f => f.severity === 'drop' && f.text.includes('Traffic Monitor')
    )
    const capImprovement = result.find(
      f => f.severity === 'improvement' && f.text.includes('Capability')
    )
    expect(critical?.snapshotId).toBe('traf-l')
    expect(trafficDrop?.snapshotId).toBe('traf-l')
    expect(capImprovement?.snapshotId).toBe('cap-l')
  })
})
