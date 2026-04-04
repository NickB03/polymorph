import type { LanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockProvider = vi.hoisted(() => vi.fn())
const mockCreateOpenAI = vi.hoisted(() => vi.fn(() => mockProvider))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI
}))

vi.mock('../config', () => ({
  config: {
    judgeModel: 'google/gemini-3.1-flash-lite-preview',
    judgeBaseUrl: 'https://openrouter.ai/api/v1'
  }
}))

vi.mock('../corpus', () => ({
  getCorpusVersion: vi.fn(() => 'v2')
}))

describe('buildDatasetExamples', () => {
  beforeEach(() => {
    mockCreateOpenAI.mockClear()
    mockProvider.mockReset()
  })

  it('maps prompt, query, and context from the latest user turn', async () => {
    const { buildDatasetExamples } = await import('./shared')

    const examples = buildDatasetExamples(
      [
        {
          id: 'case-1',
          suite: 'capability',
          conversation: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'first question' }]
            },
            {
              role: 'assistant',
              parts: [{ type: 'text', text: 'follow up?' }]
            },
            {
              role: 'user',
              parts: [{ type: 'text', text: 'last question' }]
            }
          ],
          searchMode: 'research',
          modelType: 'quality',
          tags: ['multi-turn'],
          requiresTextAnswer: true,
          requiresCitations: true,
          allowsInteractiveOnly: false
        }
      ],
      [
        {
          answerText: 'answer',
          citations: [{ title: 'Source', url: 'https://example.com' }],
          searchResults: [
            {
              query: 'last question',
              results: [
                {
                  title: 'Result 1',
                  url: 'https://example.com/r1',
                  snippet: 'Relevant snippet'
                }
              ]
            }
          ],
          toolNames: [],
          usedInteractiveOnlyOutput: false,
          modelId: 'model',
          durationMs: 1
        }
      ]
    )

    expect(examples).toHaveLength(1)
    expect(examples[0].input.prompt).toBe('last question')
    expect(examples[0].input.query).toBe('last question')
    expect(examples[0].input.prompt).toBe(examples[0].input.query)
    expect(examples[0].input.context).toContain('[Search: "last question"]')
    expect(examples[0].input.context).toContain('- Result 1: Relevant snippet')
    expect(examples[0].input.context).toContain('[Citations]')
    expect(examples[0].input.context).toContain(
      '- Source (https://example.com)'
    )
  })

  it('returns an empty context when there are no search results or citations', async () => {
    const { buildDatasetExamples } = await import('./shared')

    const examples = buildDatasetExamples(
      [
        {
          id: 'case-2',
          suite: 'regression',
          conversation: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'hello there' }]
            }
          ],
          searchMode: 'chat',
          modelType: 'speed',
          tags: [],
          requiresTextAnswer: true,
          requiresCitations: false,
          allowsInteractiveOnly: true
        }
      ],
      [
        {
          answerText: 'answer',
          citations: [],
          searchResults: [],
          toolNames: [],
          usedInteractiveOnlyOutput: false,
          modelId: 'model',
          durationMs: 1
        }
      ]
    )

    expect(examples[0].input.query).toBe('hello there')
    expect(examples[0].input.context).toBe('')
  })
})

describe('buildTimestampedDatasetName', () => {
  it('includes suite name and minute-precision timestamp', async () => {
    const { buildTimestampedDatasetName } = await import('./shared')
    const name = buildTimestampedDatasetName('traffic-monitor')
    expect(name).toMatch(
      /^polymorph-traffic-monitor-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/
    )
  })
})

describe('createJudgeModel', () => {
  beforeEach(() => {
    mockCreateOpenAI.mockClear()
    mockProvider.mockReset()
    mockCreateOpenAI.mockReturnValue(mockProvider)
    mockProvider.mockReturnValue({ id: 'judge-model' })
  })

  it('constructs the judge model through the OpenAI-compatible provider', async () => {
    const { createJudgeModel } = await import('./shared')

    const model = createJudgeModel()

    expect(mockCreateOpenAI).toHaveBeenCalledTimes(1)
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'https://openrouter.ai/api/v1'
    })
    expect(mockProvider).toHaveBeenCalledWith(
      'google/gemini-3.1-flash-lite-preview',
      {
        structuredOutputs: true
      }
    )
    expect(model).toEqual({ id: 'judge-model' })
  })
})

describe('checkExperimentThresholds', () => {
  it('passes when all evaluations score above 0.5', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds(
      {
        evaluationRuns: [
          { name: 'quality', error: null, result: { score: 1, label: 'pass' } },
          {
            name: 'faithfulness',
            error: null,
            result: { score: 0.8, label: 'faithful' }
          }
        ]
      },
      0.8
    )
    expect(result.passed).toBe(true)
    expect(result.passRate).toBe(1)
  })

  it('fails when pass rate drops below threshold', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds(
      {
        evaluationRuns: [
          { name: 'quality', error: null, result: { score: 1, label: 'pass' } },
          { name: 'quality', error: null, result: { score: 0, label: 'fail' } },
          {
            name: 'faithfulness',
            error: null,
            result: { score: 0, label: 'not_faithful' }
          }
        ]
      },
      0.8
    )
    expect(result.passed).toBe(false)
    expect(result.passRate).toBeCloseTo(0.333, 2)
    expect(result.failedEvaluators).toContain('quality')
    expect(result.failedEvaluators).toContain('faithfulness')
  })

  it('treats errored evaluations as failures', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds(
      {
        evaluationRuns: [
          { name: 'quality', error: 'timeout', result: null },
          {
            name: 'faithfulness',
            error: null,
            result: { score: 1, label: 'faithful' }
          }
        ]
      },
      0.8
    )
    expect(result.passed).toBe(false)
    expect(result.passRate).toBe(0.5)
    expect(result.failedEvaluators).toEqual(['quality'])
  })

  it('treats null scores as failures', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds(
      {
        evaluationRuns: [
          {
            name: 'faithfulness',
            error: null,
            result: { score: null, label: 'skipped' }
          },
          { name: 'quality', error: null, result: { score: 1, label: 'pass' } }
        ]
      },
      0.8
    )
    expect(result.passed).toBe(false)
    expect(result.passRate).toBe(0.5)
  })

  it('passes when there are no evaluation runs', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds({}, 0.8)
    expect(result.passed).toBe(true)
    expect(result.totalEvaluations).toBe(0)
  })
})

describe('buildExperimentEvaluators', () => {
  it('wraps LLM evaluators with retry while leaving deterministic evaluator unwrapped', async () => {
    vi.useFakeTimers()

    const { buildExperimentEvaluators } = await import('./shared')

    let callCount = 0
    const flakyEvaluate = async () => {
      callCount++
      if (callCount <= 2) throw new Error('transient failure')
      return { label: 'ok', score: 1 }
    }

    const evaluators = buildExperimentEvaluators(
      () => ({
        name: 'precheck',
        kind: 'CODE',
        evaluate: () => ({ label: 'pass', score: 1 })
      }),
      () => ({ name: 'faithfulness', kind: 'LLM', evaluate: flakyEvaluate }),
      () => ({
        name: 'relevance',
        kind: 'LLM',
        evaluate: () => ({ label: 'ok', score: 1 })
      }),
      () => ({
        name: 'quality',
        kind: 'LLM',
        evaluate: () => ({ label: 'ok', score: 1 })
      }),
      {} as LanguageModel
    )

    expect(evaluators).toHaveLength(4)
    expect(evaluators[0].name).toBe('precheck')
    expect(evaluators[1].name).toBe('faithfulness')

    // The faithfulness evaluator should retry and eventually succeed
    const resultPromise = evaluators[1].evaluate({} as any)
    await vi.advanceTimersByTimeAsync(2000) // first retry delay
    await vi.advanceTimersByTimeAsync(4000) // second retry delay
    const result = await resultPromise
    expect(result).toEqual({ label: 'ok', score: 1 })
    expect(callCount).toBe(3) // 2 failures + 1 success

    vi.useRealTimers()
  })
})
