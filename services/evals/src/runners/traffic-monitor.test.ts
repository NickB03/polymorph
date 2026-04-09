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
  checkExperimentThresholds: vi.fn(() => ({
    passed: true,
    passRate: 1,
    totalEvaluations: 1,
    passedEvaluations: 1,
    failedEvaluators: []
  })),
  createDatasetAndExperiment: mockCreateDatasetAndExperiment,
  createJudgeModel: mockCreateJudgeModel
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
  })

  it('does not throw when Phoenix is unavailable after sampling chats', async () => {
    mockSampleRecentChats.mockResolvedValueOnce([
      {
        userQuery: 'What changed in the market today?',
        modelAnswer: 'Summary',
        citations: [],
        searchResults: [],
        toolNames: []
      }
    ])
    mockBuildDatasetExamples.mockReturnValueOnce([
      {
        input: {},
        output: {},
        metadata: {}
      }
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
    errorSpy.mockRestore()
  })
})
