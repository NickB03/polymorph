import type { LanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockProvider = vi.hoisted(() => vi.fn())
const mockCreateOpenRouter = vi.hoisted(() => vi.fn(() => mockProvider))
const mockConfig = vi.hoisted(() => ({
  phoenixHost: 'http://phoenix',
  phoenixPublicUrl: 'https://phoenix.example.com',
  judgeModel: 'google/gemini-3.1-flash-lite-preview',
  judgeBaseUrl: 'https://openrouter.ai/api/v1',
  judgeApiKey: 'openrouter-key',
  judgeReasoningEnabled: true,
  judgeReasoningMaxTokens: 1024,
  evalRunnerUrl: 'http://localhost:3000',
  evalRunnerSecret: 'test-secret',
  scoreThreshold: 0.8,
  exitOnThresholdBreach: false,
  caseConcurrency: 3,
  dbPoolMax: 5,
  excludeFromThreshold: ['safety']
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mockCreateOpenRouter
}))

vi.mock('../judge-config', () => ({
  createJudgeConfig: vi.fn(() => mockConfig)
}))

vi.mock('../config', () => ({
  config: mockConfig,
  createConfig: vi.fn(() => mockConfig)
}))

const mockGetCasesForEvaluation = vi.hoisted(() => vi.fn())

vi.mock('../corpus', () => ({
  getCorpusVersion: vi.fn(() => 'v2'),
  getCasesForEvaluation: mockGetCasesForEvaluation
}))

const mockRunEvalCase = vi.hoisted(() => vi.fn())
const mockPersistEvalSummary = vi.hoisted(() => vi.fn())

vi.mock('../eval-runner-client', () => ({
  runEvalCase: mockRunEvalCase
}))

vi.mock('../eval-summary', () => ({
  persistEvalSummary: mockPersistEvalSummary
}))

const mockCreateClient = vi.hoisted(() => vi.fn(() => ({})))
const mockCreateOrGetDataset = vi.hoisted(() =>
  vi.fn(async () => ({ datasetId: 'ds-1' }))
)
const mockRunExperiment = vi.hoisted(() =>
  vi.fn(async () => ({
    id: 'exp-1',
    evaluationRuns: [
      { name: 'precheck', error: null, result: { score: 1, label: 'pass' } },
      {
        name: 'faithfulness',
        error: null,
        result: { score: 0.9, label: 'faithful' }
      },
      {
        name: 'relevance',
        error: null,
        result: { score: 0.85, label: 'relevant' }
      },
      {
        name: 'response_quality',
        error: null,
        result: { score: 0.75, label: 'good' }
      }
    ]
  }))
)

vi.mock('@arizeai/phoenix-client', () => ({
  createClient: mockCreateClient
}))

vi.mock('@arizeai/phoenix-client/datasets', () => ({
  createDataset: vi.fn(),
  createOrGetDataset: mockCreateOrGetDataset
}))

vi.mock('@arizeai/phoenix-client/experiments', () => ({
  runExperiment: mockRunExperiment,
  asExperimentEvaluator: vi.fn((e: unknown) => e)
}))

vi.mock('../evaluators/faithfulness', () => ({
  createFaithfulnessExperimentEvaluator: vi.fn(() => ({
    name: 'faithfulness',
    kind: 'LLM',
    evaluate: async () => ({ label: 'faithful', score: 0.9 })
  }))
}))

vi.mock('../evaluators/relevance', () => ({
  createRelevanceExperimentEvaluator: vi.fn(() => ({
    name: 'relevance',
    kind: 'LLM',
    evaluate: async () => ({ label: 'relevant', score: 0.85 })
  }))
}))

vi.mock('../evaluators/response-quality', () => ({
  createResponseQualityExperimentEvaluator: vi.fn(() => ({
    name: 'response_quality',
    kind: 'LLM',
    evaluate: async () => ({ label: 'good', score: 0.75 })
  }))
}))

vi.mock('../prechecks', () => ({
  createDeterministicPrecheckEvaluator: vi.fn(() => ({
    name: 'precheck',
    kind: 'CODE',
    evaluate: async () => ({ label: 'pass', score: 1 })
  }))
}))

vi.mock('../evaluators/tool-usage', () => ({
  createToolUsageExperimentEvaluator: vi.fn(() => ({
    name: 'tool_usage',
    kind: 'CODE',
    evaluate: async () => ({ label: 'skipped', score: null })
  }))
}))

vi.mock('../evaluators/safety', () => ({
  createSafetyExperimentEvaluator: vi.fn(() => ({
    name: 'safety',
    kind: 'LLM',
    evaluate: async () => ({ label: 'safe', score: 1 })
  }))
}))

describe('buildDatasetExamples', () => {
  beforeEach(() => {
    mockCreateOpenRouter.mockClear()
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
          allowsInteractiveOnly: false,
          expectsRefusal: false
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
    expect(examples[0].input.context).toContain(
      '- [Result 1](https://example.com/r1): Relevant snippet'
    )
    expect(examples[0].input.context).toContain('[Citations]')
    expect(examples[0].input.context).toContain(
      '- [Source](https://example.com)'
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
          allowsInteractiveOnly: true,
          expectsRefusal: false
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
    mockCreateOpenRouter.mockClear()
    mockProvider.mockReset()
    mockCreateOpenRouter.mockReturnValue(mockProvider)
    mockProvider.mockReturnValue({ id: 'judge-model' })
    mockConfig.judgeBaseUrl = 'https://openrouter.ai/api/v1'
    mockConfig.judgeApiKey = 'openrouter-key'
    mockConfig.judgeReasoningEnabled = false
    mockConfig.judgeReasoningMaxTokens = 1024
  })

  it('constructs the judge model through the OpenRouter provider', async () => {
    const { createJudgeModel } = await import('./shared')

    const model = createJudgeModel()

    expect(mockCreateOpenRouter).toHaveBeenCalledTimes(1)
    expect(mockCreateOpenRouter).toHaveBeenCalledWith({
      apiKey: 'openrouter-key',
      baseURL: 'https://openrouter.ai/api/v1'
    })
    expect(mockProvider).toHaveBeenCalledWith(
      'google/gemini-3.1-flash-lite-preview'
    )
    expect(model).toEqual({ id: 'judge-model' })
  })

  it('adds reasoning settings when reasoning is enabled', async () => {
    mockConfig.judgeReasoningEnabled = true
    mockConfig.judgeReasoningMaxTokens = 2048

    const { createJudgeModel } = await import('./shared')

    const model = createJudgeModel()

    expect(mockProvider).toHaveBeenCalledWith(
      'google/gemini-3.1-flash-lite-preview',
      {
        reasoning: {
          enabled: true,
          max_tokens: 2048
        }
      }
    )
    expect(model).toEqual({ id: 'judge-model' })
  })

  it('omits reasoning settings when reasoning is disabled', async () => {
    mockConfig.judgeReasoningEnabled = false

    const { createJudgeModel } = await import('./shared')

    const model = createJudgeModel()

    expect(mockProvider).toHaveBeenCalledWith(
      'google/gemini-3.1-flash-lite-preview'
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

  it('excludes null scores from the denominator', async () => {
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
    expect(result.passed).toBe(true)
    expect(result.passRate).toBe(1)
    expect(result.totalEvaluations).toBe(1)
    expect(result.passedEvaluations).toBe(1)
  })

  it('returns passed: false when all scores are null', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds(
      {
        evaluationRuns: [
          {
            name: 'faithfulness',
            error: null,
            result: { score: null, label: 'skipped' }
          },
          {
            name: 'relevance',
            error: null,
            result: { score: null, label: 'skipped' }
          }
        ]
      },
      0.8
    )
    expect(result.passed).toBe(false)
    expect(result.passRate).toBe(0)
    expect(result.totalEvaluations).toBe(0)
  })

  it('excludes named evaluators via excludeFromThreshold', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds(
      {
        evaluationRuns: [
          { name: 'quality', error: null, result: { score: 1, label: 'pass' } },
          {
            name: 'safety',
            error: null,
            result: { score: 0, label: 'unsafe' }
          }
        ]
      },
      0.8,
      ['safety']
    )
    expect(result.passed).toBe(true)
    expect(result.passRate).toBe(1)
    expect(result.totalEvaluations).toBe(1)
  })

  it('passes when there are no evaluation runs', async () => {
    const { checkExperimentThresholds } = await import('./shared')
    const result = checkExperimentThresholds({}, 0.8)
    expect(result.passed).toBe(true)
    expect(result.totalEvaluations).toBe(0)
  })
})

describe('buildPublicExperimentUrl', () => {
  it('builds a clickable URL using the public Phoenix host', async () => {
    const { buildPublicExperimentUrl } = await import('./shared')
    const url = buildPublicExperimentUrl('RGF0YXNldDoz', 'RXhwZXJpbWVudDoxOA==')
    expect(url).toBe(
      'https://phoenix.example.com/datasets/RGF0YXNldDoz/compare?experimentId=RXhwZXJpbWVudDoxOA%3D%3D'
    )
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

    const evaluators = buildExperimentEvaluators({
      prechecks: () => ({
        name: 'precheck',
        kind: 'CODE',
        evaluate: () => ({ label: 'pass', score: 1 })
      }),
      toolUsage: () => ({
        name: 'tool_usage',
        kind: 'CODE',
        evaluate: () => ({ label: 'skipped', score: null })
      }),
      faithfulness: () => ({
        name: 'faithfulness',
        kind: 'LLM',
        evaluate: flakyEvaluate
      }),
      relevance: () => ({
        name: 'relevance',
        kind: 'LLM',
        evaluate: () => ({ label: 'ok', score: 1 })
      }),
      responseQuality: () => ({
        name: 'quality',
        kind: 'LLM',
        evaluate: () => ({ label: 'ok', score: 1 })
      }),
      safety: () => ({
        name: 'safety',
        kind: 'LLM',
        evaluate: () => ({ label: 'safe', score: 1 })
      }),
      citationAccuracy: () => ({
        name: 'citation_accuracy',
        kind: 'LLM',
        evaluate: () => ({ label: 'skipped', score: null })
      }),
      model: {} as LanguageModel
    })

    expect(evaluators).toHaveLength(7)
    expect(evaluators[0].name).toBe('precheck')
    expect(evaluators[1].name).toBe('tool_usage')
    expect(evaluators[2].name).toBe('faithfulness')

    // The faithfulness evaluator should retry and eventually succeed
    const resultPromise = evaluators[2].evaluate({} as any)
    await vi.advanceTimersByTimeAsync(2000) // first retry delay
    await vi.advanceTimersByTimeAsync(4000) // second retry delay
    const result = await resultPromise
    expect(result).toEqual({ label: 'ok', score: 1 })
    expect(callCount).toBe(3) // 2 failures + 1 success

    vi.useRealTimers()
  })
})

describe('runJudgedSuite', () => {
  const makeCaseSpec = (id: string, suite: 'capability' | 'regression') => ({
    id,
    suite,
    conversation: [
      {
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: `question for ${id}` }]
      }
    ],
    searchMode: 'chat' as const,
    modelType: 'speed' as const,
    tags: [],
    requiresTextAnswer: true,
    requiresCitations: false,
    allowsInteractiveOnly: false,
    expectsRefusal: false
  })

  const makeRunResult = (id: string) => ({
    answerText: `answer for ${id}`,
    citations: [],
    searchResults: [],
    toolNames: [],
    usedInteractiveOnlyOutput: false,
    modelId: 'test-model',
    durationMs: 100
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateOpenRouter.mockReturnValue(mockProvider)
    mockProvider.mockReturnValue({ id: 'judge-model' })
    mockConfig.judgeReasoningEnabled = false
    mockPersistEvalSummary.mockResolvedValue(undefined)
  })

  it('runs all cases, creates experiment, and passes when thresholds are met', async () => {
    const cases = [
      makeCaseSpec('c1', 'capability'),
      makeCaseSpec('c2', 'capability')
    ]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase
      .mockResolvedValueOnce(makeRunResult('c1'))
      .mockResolvedValueOnce(makeRunResult('c2'))

    const { runJudgedSuite } = await import('./shared')
    const result = await runJudgedSuite('capability')

    expect(mockGetCasesForEvaluation).toHaveBeenCalledWith('capability')
    expect(mockRunEvalCase).toHaveBeenCalledTimes(2)
    expect(mockCreateOrGetDataset).toHaveBeenCalledTimes(1)
    expect(mockRunExperiment).toHaveBeenCalledTimes(1)
    expect(mockPersistEvalSummary).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('passed')
    expect(result.failedEvaluators).toEqual([])
    expect(mockPersistEvalSummary).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        threshold: 0.8,
        thresholdBreached: false,
        failedEvaluators: []
      })
    )
  })

  it('throws when all cases fail', async () => {
    const cases = [
      makeCaseSpec('c1', 'capability'),
      makeCaseSpec('c2', 'capability')
    ]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase.mockRejectedValue(new Error('network timeout'))

    const { runJudgedSuite } = await import('./shared')
    await expect(runJudgedSuite('capability')).rejects.toThrow(
      'All 2 capability cases failed'
    )

    expect(mockCreateOrGetDataset).not.toHaveBeenCalled()
    expect(mockRunExperiment).not.toHaveBeenCalled()
  })

  it('continues with partial results when some cases fail', async () => {
    const cases = [
      makeCaseSpec('c1', 'regression'),
      makeCaseSpec('c2', 'regression'),
      makeCaseSpec('c3', 'regression')
    ]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase
      .mockResolvedValueOnce(makeRunResult('c1'))
      .mockRejectedValueOnce(new Error('case c2 failed'))
      .mockResolvedValueOnce(makeRunResult('c3'))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { runJudgedSuite } = await import('./shared')
    const result = await runJudgedSuite('regression')

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1/3 regression cases failed')
    )
    expect(mockCreateOrGetDataset).toHaveBeenCalledTimes(1)
    expect(mockRunExperiment).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('passed')

    warnSpy.mockRestore()
  })

  it('returns a threshold_breached result and logs a structured warning when experiment thresholds are not met', async () => {
    const cases = [makeCaseSpec('c1', 'capability')]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase.mockResolvedValueOnce(makeRunResult('c1'))

    mockRunExperiment.mockResolvedValueOnce({
      id: 'exp-fail',
      evaluationRuns: [
        {
          name: 'faithfulness',
          error: null,
          result: { score: 0.2, label: 'bad' }
        },
        {
          name: 'relevance',
          error: null,
          result: { score: 0.1, label: 'bad' }
        },
        { name: 'quality', error: null, result: { score: 0.9, label: 'good' } }
      ]
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { runJudgedSuite } = await import('./shared')
    const result = await runJudgedSuite('capability')

    expect(result.status).toBe('threshold_breached')
    expect(result.failedEvaluators).toEqual(['faithfulness', 'relevance'])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('THRESHOLD BREACH')
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"suite":"capability"')
    )
    warnSpy.mockRestore()
  })

  it('works with the regression suite value', async () => {
    const cases = [makeCaseSpec('r1', 'regression')]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase.mockResolvedValueOnce(makeRunResult('r1'))

    const { runJudgedSuite } = await import('./shared')
    const result = await runJudgedSuite('regression')

    expect(mockGetCasesForEvaluation).toHaveBeenCalledWith('regression')
    expect(result.suite).toBe('regression')
  })

  it('throws when Phoenix is unavailable after local cases succeed', async () => {
    const cases = [makeCaseSpec('c1', 'capability')]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase.mockResolvedValueOnce(makeRunResult('c1'))
    mockCreateOrGetDataset.mockRejectedValueOnce(new Error('phoenix down'))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { runJudgedSuite } = await import('./shared')
    await expect(runJudgedSuite('capability')).rejects.toThrow(
      'experiment could not be recorded to Phoenix'
    )

    expect(errorSpy).toHaveBeenCalledWith(
      '[evals] PHOENIX UNAVAILABLE - could not record capability experiment results'
    )
    expect(mockPersistEvalSummary).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('logs a DB-specific label (not PHOENIX UNAVAILABLE) when persistEvalSummary throws', async () => {
    const cases = [makeCaseSpec('c1', 'capability')]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase.mockResolvedValueOnce(makeRunResult('c1'))
    mockPersistEvalSummary.mockRejectedValueOnce(
      new Error('connection refused')
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { runJudgedSuite } = await import('./shared')
    await expect(runJudgedSuite('capability')).rejects.toThrow(
      'eval summary could not be persisted'
    )

    expect(errorSpy).toHaveBeenCalledWith(
      '[evals] DB WRITE FAILED - could not persist capability eval summary'
    )
    expect(errorSpy).not.toHaveBeenCalledWith(
      '[evals] PHOENIX UNAVAILABLE - could not record capability experiment results'
    )
    errorSpy.mockRestore()
  })

  it('treats threshold-breached runs with failed persistence as incomplete', async () => {
    const cases = [makeCaseSpec('c1', 'capability')]
    mockGetCasesForEvaluation.mockReturnValue(cases)
    mockRunEvalCase.mockResolvedValueOnce(makeRunResult('c1'))
    mockRunExperiment.mockResolvedValueOnce({
      id: 'exp-fail',
      evaluationRuns: [
        {
          name: 'faithfulness',
          error: null,
          result: { score: 0.2, label: 'bad' }
        }
      ]
    })
    mockPersistEvalSummary.mockRejectedValueOnce(
      new Error('connection refused')
    )

    const { runJudgedSuite } = await import('./shared')

    await expect(runJudgedSuite('capability')).rejects.toThrow(
      'eval summary could not be persisted'
    )
  })
})

describe('runCasesConcurrently', () => {
  const makeConcurrencyCase = (id: string): import('../types').EvalCase => ({
    id,
    suite: 'capability',
    conversation: [
      {
        role: 'user',
        parts: [{ type: 'text', text: `question ${id}` }]
      }
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: [],
    requiresTextAnswer: true,
    requiresCitations: false,
    allowsInteractiveOnly: false,
    expectsRefusal: false
  })

  const makeConcurrencyResult = (
    id: string
  ): import('../types').EvalRunResult => ({
    answerText: `answer for ${id}`,
    citations: [],
    searchResults: [],
    toolNames: [],
    usedInteractiveOnlyOutput: false,
    modelId: 'test-model',
    durationMs: 100
  })

  beforeEach(() => {
    mockRunEvalCase.mockReset()
  })

  it('runs all cases and returns succeeded results with correct structure', async () => {
    const { runCasesConcurrently } = await import('./shared')

    const cases = [makeConcurrencyCase('a'), makeConcurrencyCase('b')]
    mockRunEvalCase.mockImplementation(
      (caseSpec: import('../types').EvalCase) =>
        Promise.resolve(makeConcurrencyResult(caseSpec.id))
    )

    const { succeeded, failCount } = await runCasesConcurrently(cases)

    expect(failCount).toBe(0)
    expect(succeeded).toHaveLength(2)
    expect(succeeded[0].caseSpec.id).toBe('a')
    expect(succeeded[0].result.answerText).toBe('answer for a')
    expect(succeeded[1].caseSpec.id).toBe('b')
    expect(succeeded[1].result.answerText).toBe('answer for b')
    expect(mockRunEvalCase).toHaveBeenCalledTimes(2)
  })

  it('respects concurrency limit of 3', async () => {
    const { runCasesConcurrently } = await import('./shared')

    let currentInFlight = 0
    let peakInFlight = 0

    mockRunEvalCase.mockImplementation(() => {
      currentInFlight++
      peakInFlight = Math.max(peakInFlight, currentInFlight)
      return new Promise<import('../types').EvalRunResult>(resolve => {
        setTimeout(() => {
          currentInFlight--
          resolve(makeConcurrencyResult('x'))
        }, 10)
      })
    })

    const cases = Array.from({ length: 7 }, (_, i) =>
      makeConcurrencyCase(`case-${i}`)
    )
    const { succeeded, failCount } = await runCasesConcurrently(cases)

    expect(succeeded).toHaveLength(7)
    expect(failCount).toBe(0)
    expect(peakInFlight).toBeLessThanOrEqual(3)
    expect(peakInFlight).toBeGreaterThanOrEqual(2)
  })

  it('individual case failure increments failCount without aborting remaining cases', async () => {
    const { runCasesConcurrently } = await import('./shared')

    mockRunEvalCase.mockImplementation(
      (caseSpec: import('../types').EvalCase) => {
        if (caseSpec.id === 'fail-me') {
          return Promise.reject(new Error('boom'))
        }
        return Promise.resolve(makeConcurrencyResult(caseSpec.id))
      }
    )

    const cases = [
      makeConcurrencyCase('ok-1'),
      makeConcurrencyCase('fail-me'),
      makeConcurrencyCase('ok-2')
    ]
    const { succeeded, failCount } = await runCasesConcurrently(cases)

    expect(failCount).toBe(1)
    expect(succeeded).toHaveLength(2)
    expect(succeeded.map(s => s.caseSpec.id)).toEqual(['ok-1', 'ok-2'])
    expect(mockRunEvalCase).toHaveBeenCalledTimes(3)
  })

  it('all cases failing returns empty succeeded with full failCount', async () => {
    const { runCasesConcurrently } = await import('./shared')

    mockRunEvalCase.mockRejectedValue(new Error('all broken'))

    const cases = [
      makeConcurrencyCase('f1'),
      makeConcurrencyCase('f2'),
      makeConcurrencyCase('f3')
    ]
    const { succeeded, failCount } = await runCasesConcurrently(cases)

    expect(succeeded).toHaveLength(0)
    expect(failCount).toBe(3)
  })

  it('empty input array returns zero results and zero failures', async () => {
    const { runCasesConcurrently } = await import('./shared')

    const { succeeded, failCount } = await runCasesConcurrently([])

    expect(succeeded).toHaveLength(0)
    expect(failCount).toBe(0)
    expect(mockRunEvalCase).not.toHaveBeenCalled()
  })

  it('mixed success and failure collects all results', async () => {
    const { runCasesConcurrently } = await import('./shared')

    mockRunEvalCase.mockImplementation(
      (caseSpec: import('../types').EvalCase) => {
        if (caseSpec.id === 'fail-1' || caseSpec.id === 'fail-2') {
          return Promise.reject(new Error(`${caseSpec.id} broke`))
        }
        return Promise.resolve(makeConcurrencyResult(caseSpec.id))
      }
    )

    const cases = [
      makeConcurrencyCase('ok-1'),
      makeConcurrencyCase('fail-1'),
      makeConcurrencyCase('ok-2'),
      makeConcurrencyCase('fail-2'),
      makeConcurrencyCase('ok-3')
    ]
    const { succeeded, failCount } = await runCasesConcurrently(cases)

    expect(failCount).toBe(2)
    expect(succeeded).toHaveLength(3)
    const ids = succeeded.map(s => s.caseSpec.id)
    expect(ids).toContain('ok-1')
    expect(ids).toContain('ok-2')
    expect(ids).toContain('ok-3')
  })
})
