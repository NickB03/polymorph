import { config } from '../config'
import { getCasesForEvaluation } from '../corpus'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createDeterministicPrecheckEvaluator } from '../prechecks'

import {
  buildDatasetExamples,
  buildExperimentEvaluators,
  buildExperimentTask,
  checkExperimentThresholds,
  createDatasetAndExperiment,
  createJudgeModel,
  runCasesConcurrently
} from './shared'

export async function runCapabilitySuite() {
  const cases = getCasesForEvaluation('capability')

  console.log(`[evals] Running capability suite with ${cases.length} cases`)

  const { succeeded, failCount } = await runCasesConcurrently(cases)

  if (succeeded.length === 0) {
    throw new Error(
      `[evals] All ${cases.length} capability cases failed, aborting experiment`
    )
  }

  if (failCount > 0) {
    console.warn(
      `[evals] ${failCount}/${cases.length} capability cases failed, recording partial results`
    )
  }

  const successCases = succeeded.map(s => s.caseSpec)
  const successResults = succeeded.map(s => s.result)
  const examples = buildDatasetExamples(successCases, successResults)
  const model = createJudgeModel()
  const evaluators = buildExperimentEvaluators(
    createDeterministicPrecheckEvaluator,
    createFaithfulnessExperimentEvaluator,
    createRelevanceExperimentEvaluator,
    createResponseQualityExperimentEvaluator,
    model
  )

  const { datasetName, experimentName, experiment } =
    await createDatasetAndExperiment({
      suite: 'capability',
      examples,
      evaluators,
      task: buildExperimentTask()
    })

  console.log(`[evals] Capability dataset: ${datasetName}`)
  console.log(`[evals] Capability experiment: ${experimentName}`)
  console.log(`[evals] Capability experiment ID: ${experiment.id}`)

  const thresholds = checkExperimentThresholds(
    experiment,
    config.scoreThreshold
  )
  console.log(
    `[evals] Capability pass rate: ${(thresholds.passRate * 100).toFixed(1)}% (${thresholds.passedEvaluations}/${thresholds.totalEvaluations})`
  )
  if (!thresholds.passed) {
    throw new Error(
      `[evals] Capability scores below threshold: ${(thresholds.passRate * 100).toFixed(1)}% < ${(config.scoreThreshold * 100).toFixed(1)}% (failing evaluators: ${thresholds.failedEvaluators.join(', ')})`
    )
  }
}
