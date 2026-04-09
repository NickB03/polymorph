import { config } from '../config'
import { formatEvalContext } from '../eval-output'
import { createCitationAccuracyExperimentEvaluator } from '../evaluators/citation-accuracy'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createSafetyExperimentEvaluator } from '../evaluators/safety'
import { createToolUsageExperimentEvaluator } from '../evaluators/tool-usage'
import { createDeterministicPrecheckEvaluator } from '../prechecks'
import { type ChatSample, sampleRecentChats } from '../sampler'

import {
  buildDatasetExamples,
  buildExperimentEvaluators,
  buildExperimentTask,
  buildPublicExperimentUrl,
  buildTimestampedDatasetName,
  checkExperimentThresholds,
  createDatasetAndExperiment,
  createJudgeModel
} from './shared'

export function formatContext(sample: ChatSample): string {
  return formatEvalContext(sample)
}

export async function runTrafficMonitorSuite() {
  console.log('[evals] Sampling recent chats...')
  const samples = await sampleRecentChats()

  if (samples.length === 0) {
    console.log('[evals] No chats found in lookback window. Exiting.')
    return
  }

  console.log(`[evals] Sampled ${samples.length} chats`)

  const cases = samples.map((sample, index) => ({
    id: `traffic-${index + 1}`,
    suite: 'traffic-monitor' as const,
    conversation: [
      {
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: sample.userQuery }]
      }
    ],
    searchMode: 'chat' as const,
    modelType: 'speed' as const,
    tags: ['traffic-monitor'],
    requiresTextAnswer: true,
    requiresCitations: sample.citations.length > 0,
    allowsInteractiveOnly: false,
    expectsRefusal: false
  }))

  const results = samples.map(sample => ({
    answerText: sample.modelAnswer,
    citations: sample.citations,
    searchResults: sample.searchResults,
    toolNames: sample.toolNames,
    usedInteractiveOnlyOutput: false,
    modelId: '',
    durationMs: 0
  }))

  const examples = buildDatasetExamples(cases, results)
  const model = createJudgeModel()
  const evaluators = buildExperimentEvaluators({
    prechecks: createDeterministicPrecheckEvaluator,
    toolUsage: createToolUsageExperimentEvaluator,
    faithfulness: createFaithfulnessExperimentEvaluator,
    relevance: createRelevanceExperimentEvaluator,
    responseQuality: createResponseQualityExperimentEvaluator,
    safety: createSafetyExperimentEvaluator,
    citationAccuracy: createCitationAccuracyExperimentEvaluator,
    model
  })

  try {
    const { datasetId, datasetName, experimentName, experiment } =
      await createDatasetAndExperiment({
        suite: 'traffic-monitor',
        examples,
        evaluators,
        task: buildExperimentTask(),
        datasetName: buildTimestampedDatasetName('traffic-monitor')
      })

    console.log(`[evals] Traffic monitor dataset: ${datasetName}`)
    console.log(`[evals] Traffic monitor experiment: ${experimentName}`)
    console.log(`[evals] Traffic monitor experiment ID: ${experiment.id}`)
    console.log(
      `[evals] Traffic monitor view: ${buildPublicExperimentUrl(datasetId, experiment.id)}`
    )

    const thresholds = checkExperimentThresholds(
      experiment,
      config.scoreThreshold,
      config.excludeFromThreshold
    )
    console.log(
      `[evals] Traffic monitor pass rate: ${(thresholds.passRate * 100).toFixed(1)}% (${thresholds.passedEvaluations}/${thresholds.totalEvaluations})`
    )
    if (!thresholds.passed) {
      console.warn(
        `[evals] Traffic monitor scores below threshold: ${(thresholds.passRate * 100).toFixed(1)}% < ${(config.scoreThreshold * 100).toFixed(1)}% (failing evaluators: ${thresholds.failedEvaluators.join(', ')})`
      )
    }
  } catch (error) {
    console.error(
      '[evals] PHOENIX UNAVAILABLE - could not record traffic-monitor experiment results'
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    console.log(
      `[evals] traffic-monitor completed ${samples.length} samples (results NOT recorded to Phoenix)`
    )
    return
  }
}
