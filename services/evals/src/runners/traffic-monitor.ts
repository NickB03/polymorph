import { config } from '../config'
import { db } from '../db'
import { formatEvalContext } from '../eval-output'
import { persistEvalSummary } from '../eval-summary'
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
  buildSuiteRunResult,
  buildTimestampedDatasetName,
  checkExperimentThresholds,
  createDatasetAndExperiment,
  createJudgeModel,
  logThresholdBreachWarning
} from './shared'

export function formatContext(sample: ChatSample): string {
  return formatEvalContext(sample)
}

export async function runTrafficMonitorSuite() {
  console.log('[evals] Sampling recent chats...')
  const samples = await sampleRecentChats()

  if (samples.length === 0) {
    throw new Error(
      '[evals] No chats found in lookback window for traffic-monitor run'
    )
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

  let datasetId: string
  let datasetName: string
  let experimentName: string
  let experiment: Awaited<
    ReturnType<typeof createDatasetAndExperiment>
  >['experiment']

  try {
    ;({ datasetId, datasetName, experimentName, experiment } =
      await createDatasetAndExperiment({
        suite: 'traffic-monitor',
        examples,
        evaluators,
        task: buildExperimentTask(),
        datasetName: buildTimestampedDatasetName('traffic-monitor')
      }))
  } catch (error) {
    console.error(
      '[evals] PHOENIX UNAVAILABLE - could not record traffic-monitor experiment results'
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    throw new Error(
      '[evals] traffic-monitor experiment could not be recorded to Phoenix'
    )
  }

  console.log(`[evals] Traffic monitor dataset: ${datasetName}`)
  console.log(`[evals] Traffic monitor experiment: ${experimentName}`)
  console.log(`[evals] Traffic monitor experiment ID: ${experiment.id}`)
  const phoenixUrl = buildPublicExperimentUrl(datasetId, experiment.id)
  console.log(`[evals] Traffic monitor view: ${phoenixUrl}`)

  const thresholds = checkExperimentThresholds(
    experiment,
    config.scoreThreshold,
    config.excludeFromThreshold
  )
  console.log(
    `[evals] Traffic monitor pass rate: ${(thresholds.passRate * 100).toFixed(1)}% (${thresholds.passedEvaluations}/${thresholds.totalEvaluations})`
  )

  const result = buildSuiteRunResult({
    suite: 'traffic-monitor',
    thresholds,
    threshold: config.scoreThreshold,
    experimentName,
    datasetName,
    phoenixUrl,
    totalCases: examples.length
  })

  if (result.status === 'threshold_breached') {
    logThresholdBreachWarning(result)
  }

  try {
    await persistEvalSummary(
      { execute: db.execute.bind(db) },
      {
        suite: 'traffic-monitor',
        experimentName,
        datasetName,
        passRate: result.passRate,
        threshold: result.threshold,
        thresholdBreached: result.status === 'threshold_breached',
        failedEvaluators: result.failedEvaluators,
        experiment,
        totalCases: result.totalCases,
        phoenixUrl
      }
    )
  } catch (error) {
    console.error(
      '[evals] DB WRITE FAILED - could not persist traffic-monitor eval summary'
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    throw new Error(
      '[evals] traffic-monitor eval summary could not be persisted'
    )
  }

  return result
}
