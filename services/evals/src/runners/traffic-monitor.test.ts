import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  scoreThreshold: 0.8,
  excludeFromThreshold: ['safety']
}))

const mockSampleRecentChats = vi.hoisted(() => vi.fn())
const mockCreateDatasetAndExperiment = vi.hoisted(() => vi.fn())
const mockBuildDatasetExamples = vi.hoisted(() => vi.fn())
const mockBuildExperimentEvaluators = vi.hoisted(() => vi.fn(() => []))
const mockBuildExperimentTask = vi.hoisted(() => vi.fn(() => vi.fn()))
const mockCreateJudgeModel = vi.hoisted(() => vi.fn(() => ({ id: 'judge' })))
const mockBuildTimestampedDatasetName = vi.hoisted(() => vi.fn(() => 'dataset'))
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

vi.mock('../config', () => ({
  config: mockConfig
}))

vi.mock('../sampler', () => ({
  sampleRecentChats: mockSampleRecentChats
}))

vi.mock('./shared', () => ({
  buildDatasetExamples: mockBuildDatasetExamples,
  buildExperimentEvaluators: mockBuildExperimentEvaluators,
  buildExperimentTask: mockBuildExperimentTask,
  buildPublicExperimentUrl: vi.fn(() => 'https://phoenix.example.com/exp'),
  buildTimestampedDatasetName: mockBuildTimestampedDatasetName,
  checkExperimentThresholds: mockCheckExperimentThresholds,
  createDatasetAndExperiment: mockCreateDatasetAndExperiment,
  createJudgeModel: mockCreateJudgeModel
}))

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

vi.mock('../prechecks', () => ({
  createDeterministicPrecheckEvaluator: vi.fn(() => ({
    name: 'precheck'
  }))
}))

describe('runTrafficMonitorSuite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    toolNames: []
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
    await expect(runTrafficMonitorSuite()).resolves.toBeUndefined()

    expect(mockPersistEvalSummary).toHaveBeenCalledTimes(1)
    expect(mockPersistEvalSummary).toHaveBeenCalledWith(
      expect.objectContaining({ execute: expect.any(Function) }),
      expect.objectContaining({
        suite: 'traffic-monitor',
        experimentName: datasetResult.experimentName,
        datasetName: datasetResult.datasetName,
        totalCases: 1,
        phoenixUrl: 'https://phoenix.example.com/exp'
      })
    )
  })

  it('logs PHOENIX UNAVAILABLE when createDatasetAndExperiment throws and does not call persist', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([sampleChat])
    mockBuildDatasetExamples.mockReturnValueOnce([
      { input: {}, output: {}, metadata: {} }
    ])
    mockCreateDatasetAndExperiment.mockRejectedValueOnce(
      new Error('phoenix down')
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await expect(runTrafficMonitorSuite()).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(
      '[evals] PHOENIX UNAVAILABLE - could not record traffic-monitor experiment results'
    )
    expect(mockPersistEvalSummary).not.toHaveBeenCalled()
    errorSpy.mockRestore()
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
    await expect(runTrafficMonitorSuite()).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(
      '[evals] DB WRITE FAILED - could not persist traffic-monitor eval summary'
    )
    expect(errorSpy).not.toHaveBeenCalledWith(
      '[evals] PHOENIX UNAVAILABLE - could not record traffic-monitor experiment results'
    )
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

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await expect(runTrafficMonitorSuite()).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Traffic monitor scores below threshold')
    )
    warnSpy.mockRestore()
  })

  it('exits cleanly when no chats are sampled and does not call persist', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([])

    const { runTrafficMonitorSuite } = await import('./traffic-monitor')
    await expect(runTrafficMonitorSuite()).resolves.toBeUndefined()

    expect(mockCreateDatasetAndExperiment).not.toHaveBeenCalled()
    expect(mockPersistEvalSummary).not.toHaveBeenCalled()
  })
})
