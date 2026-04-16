import { describe, expect, it } from 'vitest'

import {
  computeDivergences,
  DIVERGENCE_ALARM,
  DIVERGENCE_WARN
} from '../divergences'

describe('computeDivergences', () => {
  const capability = {
    faithfulness: 0.96,
    relevance: 0.95,
    safety: 0.99,
    response_quality: 0.92
  }

  it('flags evaluators where capability exceeds traffic by >= 15pts as alarm', () => {
    const traffic = { ...capability, faithfulness: 0.56 }
    const result = computeDivergences(capability, traffic)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      evaluator: 'faithfulness',
      severity: 'alarm'
    })
    expect(result[0].delta).toBeCloseTo(0.4, 2)
  })

  it('flags evaluators with 8-14pt gaps as warn', () => {
    const traffic = { ...capability, relevance: 0.85 }
    const result = computeDivergences(capability, traffic)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warn')
  })

  it('ignores gaps under the warn threshold', () => {
    const traffic = { ...capability, safety: 0.94 }
    expect(computeDivergences(capability, traffic)).toEqual([])
  })

  it('sorts results by absolute delta descending', () => {
    const traffic = {
      faithfulness: 0.56, // -0.4
      relevance: 0.85, // -0.1
      safety: 0.99,
      response_quality: 0.78 // -0.14
    }
    const result = computeDivergences(capability, traffic)
    expect(result.map(d => d.evaluator)).toEqual([
      'faithfulness',
      'response_quality',
      'relevance'
    ])
  })

  it('exports named thresholds', () => {
    expect(DIVERGENCE_WARN).toBe(0.08)
    expect(DIVERGENCE_ALARM).toBe(0.15)
  })
})
