import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  scoreThreshold: 0.8,
  exitOnThresholdBreach: false,
  excludeFromThreshold: ['safety']
}))

const mockSampleRecentChats = vi.hoisted(() => vi.fn())
const mockCreateDatasetAndExperiment = vi.hoisted(() => vi.fn())
const mockBuildDatasetExamples = vi.hoisted(() => vi.fn())
const mockBuildEvalSummaryMetadata = vi.hoisted(() => vi.fn(() => ({})))
const mockBuildExperimentEvaluators = vi.hoisted(() => vi.fn(() => []))
const mockBuildExperimentTask = vi.hoisted(() => vi.fn(() => vi.fn()))
const mockCreateJudgeModel = vi.hoisted(() => vi.fn(() => ({ id: 'judge' })))
const mockBuildTimestampedDatasetName = vi.hoisted(() => vi.fn(() => 'dataset'))
const mockRunCasesConcurrently = vi.hoisted(() => vi.fn())
const mockCheckExperimentThresholds = vi.hoisted(() =>
  vi.fn(() => ({
    passed: true,
    passRate: 1,
    totalEvaluations: 1,
    passedEvaluations: 1,
    failedEvaluators: [] as string[]
  }))
)
const mockPersistEvalSummary = vi.hoisted(() => vi.fn())
const mockDbExecute = vi.hoisted(() => vi.fn())
const mockBuildSuiteRunResult = vi.hoisted(() =>
  vi.fn(
    ({
      suite,
      thresholds,
      threshold,
      experimentName,
      datasetName,
      phoenixUrl,
      totalCases,
      attemptedCases,
      failedCases
    }) => ({
      suite,
      status: thresholds.passed ? 'passed' : 'threshold_breached',
      passRate: thresholds.passRate,
      threshold,
      failedEvaluators: thresholds.failedEvaluators,
      experimentName,
      datasetName,
      phoenixUrl,
      totalCases,
      attemptedCases,
      failedCases
    })
  )
)
const mockLogThresholdBreachWarning = vi.hoisted(() => vi.fn())

vi.mock('../config', () => ({
  config: mockConfig
}))

vi.mock('../sampler', () => ({
  sampleRecentChats: mockSampleRecentChats
}))

vi.mock('./shared', async importOriginal => {
  const actual = await importOriginal<typeof import('./shared')>()
  return {
    // Real implementation: the drop-rate gate is pure and its end-to-end
    // effect on the suite result is asserted in this file.
    applyDropRateGate: actual.applyDropRateGate,
    buildDatasetExamples: mockBuildDatasetExamples,
    buildEvalSummaryMetadata: mockBuildEvalSummaryMetadata,
    buildExperimentEvaluators: mockBuildExperimentEvaluators,
    buildExperimentTask: mockBuildExperimentTask,
    buildPublicExperimentUrl: vi.fn(() => 'https://phoenix.example.com/exp'),
    buildSuiteRunResult: mockBuildSuiteRunResult,
    buildTimestampedDatasetName: mockBuildTimestampedDatasetName,
    checkExperimentThresholds: mockCheckExperimentThresholds,
    createDatasetAndExperiment: mockCreateDatasetAndExperiment,
    createJudgeModel: mockCreateJudgeModel,
    logThresholdBreachWarning: mockLogThresholdBreachWarning,
    runCasesConcurrently: mockRunCasesConcurrently
  }
})

vi.mock('../eval-summary', () => ({
  persistEvalSummary: mockPersistEvalSummary
}))

vi.mock('../db', () => ({
  db: { execute: mockDbExecute }
}))

vi.mock('../eval-output', () => ({
  formatEvalContext: vi.fn(() => 'formatted context')
}))

vi.mock('../evaluators/citation-accuracy', () => ({
  createCitationAccuracyExperimentEvaluator: vi.fn(() => ({
    name: 'citation_accuracy'
  }))
}))

vi.mock('../evaluators/faithfulness', () => ({
  createFaithfulnessExperimentEvaluator: vi.fn(() => ({
    name: 'faithfulness'
  }))
}))

vi.mock('../evaluators/relevance', () => ({
  createRelevanceExperimentEvaluator: vi.fn(() => ({
    name: 'relevance'
  }))
}))

vi.mock('../evaluators/response-quality', () => ({
  createResponseQualityExperimentEvaluator: vi.fn(() => ({
    name: 'response_quality'
  }))
}))

vi.mock('../evaluators/safety', () => ({
  createSafetyExperimentEvaluator: vi.fn(() => ({
    name: 'safety'
  }))
}))

vi.mock('../evaluators/tool-usage', () => ({
  createToolUsageExperimentEvaluator: vi.fn(() => ({
    name: 'tool_usage'
  }))
}))

vi.mock('../evaluators/tool-selection', () => ({
  createToolSelectionExperimentEvaluator: vi.fn(() => ({
    name: 'tool_selection',
    kind: 'LLM',
    evaluate: vi.fn()
  }))
}))

vi.mock('../prechecks', () => ({
  createDeterministicPrecheckEvaluator: vi.fn(() => ({
    name: 'precheck'
  }))
}))

describe('runTrafficMonitorSuite', () => {
  const replayedCase = {
    id: 'traffic-1',
    suite: 'traffic-monitor' as const,
    conversation: [
      {
        role: 'user' as const,
        parts: [
          {
            type: 'text' as const,
            text: 'What changed in the market today?'
          }
        ]
      }
    ],
    searchMode: 'chat' as const,
    modelType: 'speed' as const,
    tags: ['traffic-monitor', 'mode_metadata_missing'],
    requiresTextAnswer: true,
    requiresCitations: false,
    allowsInteractiveOnly: false,
    expectsRefusal: false
  }

  const replayedResult = {
    answerText: 'Replayed summary',
    citations: [],
    searchResults: [],
    toolNames: [],
    usedInteractiveOnlyOutput: false,
    modelId: 'test-model',
    durationMs: 123
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRunCasesConcurrently.mockResolvedValue({
      succeeded: [{ caseSpec: replayedCase, result: replayedResult }],
      failCount: 0
    })
    mockPersistEvalSummary.mockResolvedValue(undefined)
    mockCheckExperimentThresholds.mockReturnValue({
      passed: true,
      passRate: 1,
      totalEvaluations: 1,
      passedEvaluations: 1,
      failedEvaluators: []
    })
  })

  const sampleChat = {
    chatId: 'chat-1',
    createdAt: new Date('2026-04-13T00:00:00Z'),
    userQuery: 'What changed in the market today?',
    modelAnswer: 'Summary',
    citations: [],
    searchResults: [],
    toolNames: [],
    conversation: replayedCase.conversation,
    targetUserMessageId: 'user-1',
    targetAssistantMessageId: 'assistant-1',
    searchMode: 'chat' as const,
    modelType: 'speed' as const,
    metadataTags: ['mode_metadata_missing']
  }

  const datasetResult = {
    datasetId: 'ds-1',
    datasetName: 'polymorph-traffic-monitor-2026-04-13-00-00',
    experimentName: 'polymorph-traffic-monitor-2026-04-13-00-00-00',
    experiment: {
      id: 'exp-tm-1',
      evaluationRuns: [
        { name: 'faithfulness', error: null, result: { score: 0.9 } }
      ]
    }
  }

  it('persists an eval summary row after a successful traffic-monitor experiment', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([sampleChat])
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    const result = await runTrafficMonitorSuite()

    expect(mockPersistEvalSummary).toHaveBeenCalledTimes(1)
    expect(mockRunCasesConcurrently).toHaveBeenCalledWith([replayedCase])
    expect(mockBuildDatasetExamples).toHaveBeenCalledWith(
      [replayedCase],
      [replayedResult]
    )
    expect(mockPersistEvalSummary).toHaveBeenCalledWith(
      expect.objectContaining({ execute: expect.any(Function) }),
      expect.objectContaining({
        suite: 'traffic-monitor',
        experimentName: datasetResult.experimentName,
        datasetName: datasetResult.datasetName,
        threshold: 0.8,
        thresholdBreached: false,
        failedEvaluators: [],
        totalCases: 1,
        phoenixUrl: 'https://phoenix.example.com/exp'
      })
    )
    expect(result?.status).toBe('passed')
  })

  it('replays build samples with build user mode and intent while keeping chat search mode', async () => {
    const buildSample = {
      ...sampleChat,
      userMode: 'build' as const,
      intent: 'build',
      searchMode: 'chat' as const,
      modelType: 'quality' as const,
      metadataTags: ['user-mode:build']
    }
    mockSampleRecentChats.mockResolvedValueOnce([buildSample])
    mockRunCasesConcurrently.mockResolvedValueOnce({
      succeeded: [
        {
          caseSpec: {
            ...replayedCase,
            userMode: 'build' as const,
            intent: 'build',
            modelType: 'quality' as const,
            tags: ['traffic-monitor', 'user-mode:build']
          },
          result: replayedResult
        }
      ],
      failCount: 0
    })
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await runTrafficMonitorSuite()

    expect(mockRunCasesConcurrently).toHaveBeenCalledWith([
      expect.objectContaining({
        searchMode: 'chat',
        userMode: 'build',
        intent: 'build',
        modelType: 'quality',
        tags: ['traffic-monitor', 'user-mode:build']
      })
    ])
  })

  it('throws when createDatasetAndExperiment cannot record to Phoenix', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([sampleChat])
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockRejectedValueOnce(
      new Error('phoenix down')
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await expect(runTrafficMonitorSuite()).rejects.toThrow(
      'experiment could not be recorded to Phoenix'
    )

    expect(errorSpy).toHaveBeenCalledWith(
      '[evals] PHOENIX UNAVAILABLE - could not record traffic-monitor experiment results'
    )
    expect(mockPersistEvalSummary).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('records partial traffic-monitor replay results when some cases fail', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([
      sampleChat,
      {
        ...sampleChat,
        chatId: 'chat-2',
        userQuery: 'How did bonds move?',
        conversation: [
          {
            role: 'user' as const,
            parts: [{ type: 'text' as const, text: 'How did bonds move?' }]
          }
        ],
        targetUserMessageId: 'user-2',
        targetAssistantMessageId: 'assistant-2'
      }
    ])
    mockRunCasesConcurrently.mockResolvedValueOnce({
      succeeded: [{ caseSpec: replayedCase, result: replayedResult }],
      failCount: 1
    })
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    const result = await runTrafficMonitorSuite()

    expect(warnSpy).toHaveBeenCalledWith(
      '[evals] 1/2 traffic-monitor cases failed, recording partial results'
    )
    expect(mockCreateDatasetAndExperiment).toHaveBeenCalledTimes(1)
    if (result === null) throw new Error('Expected traffic-monitor result')
    expect(result.status).toBe('passed')

    warnSpy.mockRestore()
  })

  it('throws before Phoenix when all traffic-monitor replays fail', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([sampleChat])
    mockRunCasesConcurrently.mockResolvedValueOnce({
      succeeded: [],
      failCount: 1
    })

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await expect(runTrafficMonitorSuite()).rejects.toThrow(
      'All 1 traffic-monitor cases failed, aborting experiment'
    )

    expect(mockBuildDatasetExamples).not.toHaveBeenCalled()
    expect(mockCreateDatasetAndExperiment).not.toHaveBeenCalled()
    expect(mockPersistEvalSummary).not.toHaveBeenCalled()
  })

  it('logs DB WRITE FAILED when persistEvalSummary throws', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([sampleChat])
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)
    mockPersistEvalSummary.mockRejectedValueOnce(
      new Error('connection refused')
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await expect(runTrafficMonitorSuite()).rejects.toThrow(
      'eval summary could not be persisted'
    )

    expect(errorSpy).toHaveBeenCalledWith(
      '[evals] DB WRITE FAILED - could not persist traffic-monitor eval summary'
    )
    expect(errorSpy).not.toHaveBeenCalledWith(
      '[evals] PHOENIX UNAVAILABLE - could not record traffic-monitor experiment results'
    )
    errorSpy.mockRestore()
  })

  it('logs THRESHOLD BREACH warning even when persistence fails, then throws the DB-write error', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([sampleChat])
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)
    mockCheckExperimentThresholds.mockReturnValueOnce({
      passed: false,
      passRate: 0.1,
      totalEvaluations: 1,
      passedEvaluations: 0,
      failedEvaluators: ['faithfulness']
    })
    mockPersistEvalSummary.mockRejectedValueOnce(
      new Error('connection refused')
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')

    await expect(runTrafficMonitorSuite()).rejects.toThrow(
      'traffic-monitor eval summary could not be persisted'
    )

    // Ordering assertion: logThresholdBreachWarning must be invoked BEFORE
    // the DB WRITE FAILED error is logged. If persistence runs first and
    // throws, the current (buggy) ordering skips the breach warning entirely.
    expect(mockLogThresholdBreachWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        suite: 'traffic-monitor',
        status: 'threshold_breached'
      })
    )
    const breachCallOrder =
      mockLogThresholdBreachWarning.mock.invocationCallOrder[0]

    const dbErrorIdx = errorSpy.mock.calls.findIndex(call =>
      String(call[0]).startsWith(
        '[evals] DB WRITE FAILED - could not persist traffic-monitor eval summary'
      )
    )
    expect(dbErrorIdx).toBeGreaterThanOrEqual(0)
    const dbErrorCallOrder = errorSpy.mock.invocationCallOrder[dbErrorIdx]

    expect(dbErrorCallOrder).toBeGreaterThan(breachCallOrder)

    errorSpy.mockRestore()
  })

  it('warns but does not throw when traffic-monitor scores are below threshold', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([sampleChat])
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)
    mockCheckExperimentThresholds.mockReturnValueOnce({
      passed: false,
      passRate: 0.42,
      totalEvaluations: 3,
      passedEvaluations: 1,
      failedEvaluators: ['faithfulness', 'relevance']
    })

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    const result = await runTrafficMonitorSuite()

    expect(result?.status).toBe('threshold_breached')
    expect(mockLogThresholdBreachWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        suite: 'traffic-monitor',
        status: 'threshold_breached'
      })
    )
  })

  it('persists attempted and failed case counts', async () => {
    const succeededCase = replayedCase
    mockSampleRecentChats.mockResolvedValueOnce([
      sampleChat,
      { ...sampleChat, chatId: 'chat-2' },
      { ...sampleChat, chatId: 'chat-3' }
    ])
    mockRunCasesConcurrently.mockResolvedValueOnce({
      succeeded: [{ caseSpec: succeededCase, result: replayedResult }],
      failCount: 2
    })
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await runTrafficMonitorSuite()

    expect(mockPersistEvalSummary).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        totalCases: 1,
        attemptedCases: 3,
        failedCases: 2
      })
    )
  })

  it('marks the run threshold_breached when drop rate exceeds 50%', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([
      sampleChat,
      { ...sampleChat, chatId: 'chat-2' },
      { ...sampleChat, chatId: 'chat-3' },
      { ...sampleChat, chatId: 'chat-4' }
    ])
    // 1 success, 3 failures = 75% drop rate
    mockRunCasesConcurrently.mockResolvedValueOnce({
      succeeded: [{ caseSpec: replayedCase, result: replayedResult }],
      failCount: 3
    })
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)
    // Evaluator scoring "passes" — we want drop-rate alone to trip threshold
    mockCheckExperimentThresholds.mockReturnValueOnce({
      passed: true,
      passRate: 1,
      totalEvaluations: 1,
      passedEvaluations: 1,
      failedEvaluators: []
    })

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    const result = await runTrafficMonitorSuite()

    if (result === null) throw new Error('Expected traffic-monitor result')
    expect(result.status).toBe('threshold_breached')
    expect(result.failedEvaluators).toContain('replay-drop-rate')
  })

  it('does not enforce historical citations on replay cases', async () => {
    const sampleWithCitations = {
      ...sampleChat,
      citations: [{ url: 'https://example.com', title: 'Source' }]
    }
    mockSampleRecentChats.mockResolvedValueOnce([sampleWithCitations])
    mockRunCasesConcurrently.mockResolvedValueOnce({
      succeeded: [{ caseSpec: replayedCase, result: replayedResult }],
      failCount: 0
    })
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await runTrafficMonitorSuite()

    expect(mockRunCasesConcurrently).toHaveBeenCalledWith([
      expect.objectContaining({ requiresCitations: false })
    ])
  })

  it('returns null and logs NO TRAFFIC when sampler returns no chats', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([])
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    const result = await runTrafficMonitorSuite()

    expect(result).toBeNull()
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('NO TRAFFIC')
    expect(mockCreateDatasetAndExperiment).not.toHaveBeenCalled()
    expect(mockRunCasesConcurrently).not.toHaveBeenCalled()
    expect(mockPersistEvalSummary).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})
