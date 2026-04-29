import { describe, expect, it } from 'vitest'

import {
  DEFINITIONS,
  getJudgeDefinition,
  getScoreInsight,
  snapshotSuiteKey
} from './glossary'

describe('glossary', () => {
  it('defines every canonical term', () => {
    expect(DEFINITIONS.benchmarks).toMatch(/curated/i)
    expect(DEFINITIONS.trafficMonitor).toMatch(/live|production/i)
    expect(DEFINITIONS.regression).toMatch(/pinned|drift/i)
    expect(DEFINITIONS.aggregateScore).toMatch(/weighted/i)
    expect(DEFINITIONS.passRate).toMatch(/%|threshold/i)
  })

  it('returns judge definitions for all known judge keys', () => {
    expect(getJudgeDefinition('faithfulness')).toMatch(/grounded/i)
    expect(getJudgeDefinition('safety')).toMatch(/harmful|policy/i)
    expect(getJudgeDefinition('not_a_real_judge')).toBeNull()
  })

  it('maps snapshot suite enum to glossary suite key', () => {
    expect(snapshotSuiteKey({ suite: 'capability' } as never)).toBe(
      'benchmarks'
    )
    expect(snapshotSuiteKey({ suite: 'traffic-monitor' } as never)).toBe(
      'trafficMonitor'
    )
    expect(snapshotSuiteKey({ suite: 'regression' } as never)).toBe(
      'regression'
    )
  })

  it('returns score insight for known suite/judge pairs', () => {
    const insight = getScoreInsight('trafficMonitor', 'citation_accuracy')
    expect(insight).not.toBeNull()
    expect(insight!.passed).toBeLessThanOrEqual(insight!.total)
    expect(insight!.failureModes!.length).toBeGreaterThan(0)
  })

  it('returns null for unknown suite/judge', () => {
    expect(getScoreInsight('benchmarks', 'not_a_judge')).toBeNull()
  })
})
