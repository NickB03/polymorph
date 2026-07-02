import { config } from '../config'
import { db } from '../db'
import { EvalSummaryPersistError } from '../error'
import { formatEvalContext } from '../eval-output'
import { persistEvalSummary } from '../eval-summary'
import { createCitationAccuracyExperimentEvaluator } from '../evaluators/citation-accuracy'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createNoToolPlaceholdersExperimentEvaluator } from '../evaluators/no-tool-placeholders'
import { createRefusalExperimentEvaluator } from '../evaluators/refusal'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createSafetyExperimentEvaluator } from '../evaluators/safety'
import { createToolSelectionExperimentEvaluator } from '../evaluators/tool-selection'
import { createToolUsageExperimentEvaluator } from '../evaluators/tool-usage'
import { createDeterministicPrecheckEvaluator } from '../prechecks'
import { type ChatSample, sampleRecentChats } from '../sampler'
import type { EvalCase } from '../types'

import {
  applyDropRateGate,
  buildDatasetExamples,
  buildEvalSummaryMetadata,
  buildExperimentEvaluators,
  buildExperimentTask,
  buildPublicExperimentUrl,
  buildSuiteRunResult,
  buildTimestampedDatasetName,
  checkExperimentThresholds,
  createDatasetAndExperiment,
  createJudgeModel,
  logThresholdBreachWarning,
  runCasesConcurrently
} from './shared'

const NO_TRAFFIC_SAMPLES_MESSAGE =
  '[evals] NO TRAFFIC - no chats found in lookback window; skipping traffic-monitor suite'

export function formatContext(sample: ChatSample): string {
  return formatEvalContext(sample)
}

export async function runTrafficMonitorSuite() {
  console.log('[evals] Sampling recent chats...')
  const samples = await sampleRecentChats()

  if (samples.length === 0) {
    console.warn(NO_TRAFFIC_SAMPLES_MESSAGE)
    return null
  }

  console.log(`[evals] Sampled ${samples.length} chats`)

  const cases: EvalCase[] = samples.map((sample, index) => ({
    id: `traffic-${index + 1}`,
    suite: 'traffic-monitor',
    conversation: sample.conversation,
    searchMode: sample.searchMode,
    ...(sample.userMode ? { userMode: sample.userMode } : {}),
    ...(sample.intent ? { intent: sample.intent } : {}),
    modelType: sample.modelType,
    tags: ['traffic-monitor', ...sample.metadataTags],
    requiresTextAnswer: true,
    // The historical answer's citations are not a hard contract for the
    // replay. Production may legitimately route a similar question without
    // search and still produce a correct answer. The LLM judges
    // (faithfulness, citation-accuracy) score citation quality nuancedly;
    // the deterministic precheck must not hard-fail on routing changes.
    requiresCitations: false,
    allowsInteractiveOnly: false,
    expectsRefusal: false
  }))

  console.log(
    `[evals] Replaying ${cases.length} traffic samples through the runner...`
  )

  const { succeeded, failCount } = await runCasesConcurrently(cases)

  if (succeeded.length === 0) {
    throw new Error(
      `[evals] All ${cases.length} traffic-monitor cases failed, aborting experiment`
    )
  }

  if (failCount > 0) {
    console.warn(
      `[evals] ${failCount}/${cases.length} traffic-monitor cases failed, recording partial results`
    )
  }

  const successCases = succeeded.map(s => s.caseSpec)
  const successResults = succeeded.map(s => s.result)
  const examples = buildDatasetExamples(successCases, successResults)
  const model = createJudgeModel()
  const evaluators = buildExperimentEvaluators({
    prechecks: createDeterministicPrecheckEvaluator,
    toolUsage: createToolUsageExperimentEvaluator,
    noToolPlaceholders: createNoToolPlaceholdersExperimentEvaluator,
    toolSelection: createToolSelectionExperimentEvaluator,
    faithfulness: createFaithfulnessExperimentEvaluator,
    relevance: createRelevanceExperimentEvaluator,
    responseQuality: createResponseQualityExperimentEvaluator,
    safety: createSafetyExperimentEvaluator,
    citationAccuracy: createCitationAccuracyExperimentEvaluator,
    refusal: createRefusalExperimentEvaluator,
    model
  })

  let datasetId: string
  let datasetVersion: string
  let datasetExamples: Awaited<
    ReturnType<typeof createDatasetAndExperiment>
  >['datasetExamples']
  let datasetName: string
  let experimentName: string
  let experiment: Awaited<
    ReturnType<typeof createDatasetAndExperiment>
  >['experiment']

  try {
    ;({
      datasetId,
      datasetVersion,
      datasetExamples,
      datasetName,
      experimentName,
      experiment
    } = await createDatasetAndExperiment({
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
    totalCases: examples.length,
    attemptedCases: cases.length,
    failedCases: failCount
  })

  applyDropRateGate(result, cases.length, failCount)

  if (result.status === 'threshold_breached') {
    logThresholdBreachWarning(result)
  }

  try {
    await persistEvalSummary(db, {
      suite: 'traffic-monitor',
      experimentName,
      datasetName,
      passRate: result.passRate,
      threshold: result.threshold,
      thresholdBreached: result.status === 'threshold_breached',
      failedEvaluators: result.failedEvaluators,
      experiment,
      totalCases: result.totalCases,
      attemptedCases: result.attemptedCases,
      failedCases: result.failedCases,
      phoenixUrl,
      datasetExamples,
      datasetVersion,
      ...buildEvalSummaryMetadata(config)
    })
  } catch (error) {
    console.error(
      '[evals] DB WRITE FAILED - could not persist traffic-monitor eval summary'
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    throw new EvalSummaryPersistError(
      '[evals] traffic-monitor eval summary could not be persisted',
      result
    )
  }

  return result
}
