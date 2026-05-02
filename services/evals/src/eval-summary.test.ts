import { describe, expect, it, vi } from 'vitest'

import {
  buildEvalCaseResultRows,
  classifyFailureMode,
  computeEvaluatorAverages,
  isFailedEvaluation,
  normalizeEvaluationRuns,
  persistEvalSummary
} from './eval-summary'

function createTransactionDb(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    execute: vi.fn(),
    transaction: vi.fn(async callback => callback({ execute }))
  }
}

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

describe('eval case diagnostics', () => {
  it('maps evaluation runs back to dataset examples and trace metadata', () => {
    const rows = buildEvalCaseResultRows({
      summaryId: 'summary-1',
      suite: 'capability',
      experimentName: 'exp-1',
      phoenixUrl: 'https://phoenix.example.com/exp-1',
      datasetExamples: [
        {
          id: 'example-1',
          input: {
            caseId: 'case-1',
            modelType: 'chat',
            searchMode: 'auto'
          },
          output: {},
          metadata: { caseId: 'metadata-case-1' }
        }
      ] as never,
      experiment: {
        id: 'exp-1',
        runs: {
          'run-1': {
            datasetExampleId: 'example-1',
            output: {
              modelId: 'gpt-4.1-mini',
              correlationId: 'corr-1',
              otelTraceId: 'otel-1'
            }
          }
        },
        evaluationRuns: [
          {
            name: 'citation_accuracy',
            experimentRunId: 'run-1',
            annotatorKind: 'LLM',
            error: null,
            result: {
              score: 0.25,
              label: 'bad_citation',
              explanation: 'Citation does not support the claim.'
            },
            traceId: 'judge-trace-1'
          }
        ]
      } as never
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      evalSummaryId: 'summary-1',
      suite: 'capability',
      experimentName: 'exp-1',
      experimentRunId: 'run-1',
      datasetExampleId: 'example-1',
      caseId: 'case-1',
      evaluatorName: 'citation_accuracy',
      annotatorKind: 'LLM',
      scoreBps: 2500,
      label: 'bad_citation',
      explanation: 'Citation does not support the claim.',
      failed: true,
      failureMode: 'bad_citation',
      appModelId: 'gpt-4.1-mini',
      modelType: 'chat',
      searchMode: 'auto',
      correlationId: 'corr-1',
      otelTraceId: 'otel-1',
      evaluatorTraceId: 'judge-trace-1',
      phoenixUrl: 'https://phoenix.example.com/exp-1'
    })
  })

  it('keeps null scores as skipped instead of failed', () => {
    const rows = buildEvalCaseResultRows({
      summaryId: 'summary-1',
      suite: 'regression',
      experimentName: 'exp-1',
      phoenixUrl: null,
      datasetExamples: [
        {
          id: 'example-1',
          input: { caseId: 'case-1' },
          output: {},
          metadata: {}
        }
      ] as never,
      experiment: {
        id: 'exp-1',
        runs: {
          'run-1': {
            datasetExampleId: 'example-1',
            output: {}
          }
        },
        evaluationRuns: [
          {
            name: 'faithfulness',
            experimentRunId: 'run-1',
            error: null,
            result: {
              score: null,
              label: 'skipped',
              explanation: 'No retrieved context was present.'
            }
          }
        ]
      } as never
    })

    expect(rows[0]).toMatchObject({
      scoreBps: null,
      failed: false,
      failureMode: 'other'
    })
  })

  it('treats errors and scores below 0.5 as failed', () => {
    expect(
      isFailedEvaluation({ name: 'safety', error: 'timeout' } as never)
    ).toBe(true)
    expect(
      isFailedEvaluation({
        name: 'safety',
        error: null,
        result: { score: 0.49 }
      } as never)
    ).toBe(true)
    expect(
      isFailedEvaluation({
        name: 'safety',
        error: null,
        result: { score: null }
      } as never)
    ).toBe(false)
  })

  it('classifies stable failure modes from evaluator output', () => {
    expect(
      classifyFailureMode({
        evaluatorName: 'tool_usage',
        label: 'tools_missing',
        explanation: null,
        failed: true
      })
    ).toBe('tool_not_called')
    expect(
      classifyFailureMode({
        evaluatorName: 'faithfulness',
        label: 'unfaithful',
        explanation: 'Contradicts context.',
        failed: true
      })
    ).toBe('contradicts_context')
  })
})

describe('persistEvalSummary', () => {
  it('persists a summary and clears stale diagnostics in one transaction', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = createTransactionDb(execute)

    await persistEvalSummary(db as never, {
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
      attemptedCases: 8,
      failedCases: 0,
      phoenixUrl: 'https://phoenix.example.com/exp-1'
    })

    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        queryChunks: expect.any(Array)
      })
    )
    expect(execute.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        queryChunks: expect.any(Array)
      })
    )
  })

  it('persists case diagnostics after the aggregate summary', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'summary-db-id' }] })
      .mockResolvedValue(undefined)
    const db = createTransactionDb(execute)

    await persistEvalSummary(db as never, {
      suite: 'capability',
      experimentName: 'exp-with-details',
      datasetName: 'dataset-1',
      passRate: 0.5,
      threshold: 0.8,
      thresholdBreached: true,
      failedEvaluators: ['safety'],
      experiment: {
        id: 'exp-with-details',
        runs: {
          'run-1': {
            datasetExampleId: 'example-1',
            output: { modelId: 'gpt-4.1-mini' }
          }
        },
        evaluationRuns: [
          {
            name: 'safety',
            experimentRunId: 'run-1',
            error: null,
            result: {
              score: 0,
              label: 'unsafe',
              explanation: 'Unsafe response.'
            }
          }
        ]
      } as never,
      datasetExamples: [
        {
          id: 'example-1',
          input: { caseId: 'case-1' },
          output: {},
          metadata: {}
        }
      ] as never,
      datasetVersion: 'dataset-version-1',
      sampleSize: 1,
      lookbackHours: 48,
      judgeProvider: 'openrouter',
      judgeModel: 'openai/gpt-4o',
      judgeBaseUrl: 'https://openrouter.ai/api/v1',
      judgeSettings: { temperature: 0 },
      corpusVersion: 'v6',
      evaluatorTemplateVersion: 'v1',
      appGitSha: 'abc123',
      totalCases: 1,
      attemptedCases: 1,
      failedCases: 0,
      phoenixUrl: 'https://phoenix.example.com/exp-with-details'
    })

    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(3)
    expect(execute.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ queryChunks: expect.any(Array) })
    )
    expect(execute.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ queryChunks: expect.any(Array) })
    )
    expect(execute.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({ queryChunks: expect.any(Array) })
    )
  })
})

describe('persistEvalSummary traffic-monitor support', () => {
  it('accepts traffic-monitor as a valid suite value', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = createTransactionDb(execute)

    await persistEvalSummary(db as never, {
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
      attemptedCases: 25,
      failedCases: 0,
      phoenixUrl: 'https://phoenix.example.com/traffic-exp-1'
    })

    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
