import { describe, expect, it, vi } from 'vitest'

import {
  computeEvaluatorAverages,
  normalizeEvaluationRuns,
  persistEvalSummary
} from './eval-summary'

describe('normalizeEvaluationRuns', () => {
  it('handles missing or non-array evaluationRuns', () => {
    expect(normalizeEvaluationRuns({ id: 'exp-1' } as never)).toEqual([])
    expect(
      normalizeEvaluationRuns({
        id: 'exp-2',
        evaluationRuns: null
      } as never)
    ).toEqual([])
  })
})

describe('computeEvaluatorAverages', () => {
  it('averages scores grouped by evaluator name', () => {
    const runs = [
      { name: 'faithfulness', error: null, result: { score: 0.8 } },
      { name: 'faithfulness', error: null, result: { score: 1.0 } },
      { name: 'relevance', error: null, result: { score: 0.6 } },
      { name: 'relevance', error: null, result: { score: 0.8 } }
    ] as never

    expect(computeEvaluatorAverages(runs)).toEqual({
      faithfulness: 0.9,
      relevance: 0.7
    })
  })

  it('skips errored and null-scored runs', () => {
    const runs = [
      { name: 'safety', error: 'timeout', result: null },
      { name: 'safety', error: null, result: { score: null } },
      { name: 'safety', error: null, result: { score: 1.0 } }
    ] as never

    expect(computeEvaluatorAverages(runs)).toEqual({ safety: 1.0 })
  })
})

describe('persistEvalSummary', () => {
  it('persists a summary with a typed sql statement', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await persistEvalSummary({ execute } as never, {
      suite: 'capability',
      experimentName: 'exp-1',
      datasetName: 'dataset-1',
      passRate: 0.875,
      threshold: 0.8,
      thresholdBreached: false,
      failedEvaluators: [],
      experiment: {
        id: 'exp-1',
        evaluationRuns: [
          {
            name: 'faithfulness',
            error: null,
            result: { score: 0.75 }
          },
          {
            name: 'faithfulness',
            error: null,
            result: { score: 1.0 }
          }
        ]
      } as never,
      totalCases: 8,
      phoenixUrl: 'https://phoenix.example.com/exp-1'
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        queryChunks: expect.any(Array)
      })
    )
  })
})

describe('persistEvalSummary traffic-monitor support', () => {
  it('accepts traffic-monitor as a valid suite value', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await persistEvalSummary({ execute } as never, {
      suite: 'traffic-monitor',
      experimentName: 'traffic-exp-1',
      datasetName: 'traffic-dataset-1',
      passRate: 0.91,
      threshold: 0.8,
      thresholdBreached: true,
      failedEvaluators: ['faithfulness'],
      experiment: {
        id: 'traffic-exp-1',
        evaluationRuns: [
          { name: 'faithfulness', error: null, result: { score: 0.9 } }
        ]
      } as never,
      totalCases: 25,
      phoenixUrl: 'https://phoenix.example.com/traffic-exp-1'
    })

    expect(execute).toHaveBeenCalledTimes(1)
  })
})
