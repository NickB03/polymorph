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
    suite: 'capability',
    experimentName: 'x',
    datasetName: 'y',
    passRate: 0.9,
    threshold: 0.8,
    thresholdBreached: false,
    failedEvaluators: [],
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
  trafPassRate = 0.9,
  criticalSuite: 'capability' | 'regression' | 'traffic-monitor' | null = null
): EvalsDashboardData {
  return {
    capability: {
      latest: snap({
        id: 'cap-l',
        suite: 'capability',
        evaluatorScores: capLatest,
        thresholdBreached: criticalSuite === 'capability'
      }),
      previous: snap({ id: 'cap-p', evaluatorScores: capPrev }),
      trend: [],
      lastUpdated: null
    },
    regression: {
      latest:
        criticalSuite === 'regression'
          ? snap({
              id: 'reg-l',
              suite: 'regression',
              evaluatorScores: { safety: 0.4 },
              passRate: 0.62,
              thresholdBreached: true,
              failedEvaluators: ['safety']
            })
          : null,
      previous: null,
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: snap({
        id: 'traf-l',
        suite: 'traffic-monitor',
        evaluatorScores: trafLatest,
        passRate: trafPassRate,
        thresholdBreached: criticalSuite === 'traffic-monitor'
      }),
      previous: snap({
        id: 'traf-p',
        suite: 'traffic-monitor',
        evaluatorScores: trafPrev
      }),
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

  it('emits a critical finding when the latest traffic run breached threshold', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        0.72,
        'traffic-monitor'
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

  it('does not fabricate a finding when an evaluator exists in latest but not previous', () => {
    // Scenario: capability latest has a NEW evaluator key that previous lacks.
    // Under the bug, (previous[key] ?? 0) makes that a phantom +85pt improvement.
    // After the fix, evaluators missing from previous are skipped, so the only
    // key with a defined delta (faithfulness) has zero delta and no finding fires.
    const result = computeFindings(
      data(
        { faithfulness: 0.9, citation_accuracy: 0.85 }, // cap latest
        { faithfulness: 0.9 }, // cap previous — no citation_accuracy
        { faithfulness: 0.9 }, // traf latest
        { faithfulness: 0.9 } // traf previous
      )
    )

    expect(result).toHaveLength(0)
  })

  it('sorts by severity: critical > drop > improvement', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.95, relevance: 0.5 },
        { faithfulness: 0.8, relevance: 0.6 },
        0.72,
        'traffic-monitor'
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
        0.72,
        'traffic-monitor'
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

  it('emits a critical finding for regression threshold breaches', () => {
    const result = computeFindings(
      data(
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        { faithfulness: 0.9 },
        0.9,
        'regression'
      )
    )

    expect(result[0].severity).toBe('critical')
    expect(result[0].text).toContain('Regression')
    expect(result[0].snapshotId).toBe('reg-l')
  })

  it('emits a critical finding for legacy traffic-monitor rows without threshold metadata', () => {
    const evalsData = data(
      { faithfulness: 0.9 },
      { faithfulness: 0.9 },
      { faithfulness: 0.9 },
      { faithfulness: 0.9 },
      0.72
    )
    evalsData.trafficMonitor.latest = {
      ...evalsData.trafficMonitor.latest!,
      threshold: null,
      thresholdBreached: false
    }

    const result = computeFindings(evalsData)

    expect(result.some(f => f.severity === 'critical')).toBe(true)
    expect(result[0].text).toContain('Traffic Monitor')
    expect(result[0].snapshotId).toBe('traf-l')
  })
})
