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

export async function runRegressionSuite() {
  const cases = getCasesForEvaluation('regression')

  console.log(`[evals] Running regression suite with ${cases.length} cases`)

  const { succeeded, failCount } = await runCasesConcurrently(cases)

  if (succeeded.length === 0) {
    throw new Error(
      `[evals] All ${cases.length} regression cases failed, aborting experiment`
    )
  }

  if (failCount > 0) {
    console.warn(
      `[evals] ${failCount}/${cases.length} regression cases failed, recording partial results`
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
      suite: 'regression',
      examples,
      evaluators,
      task: buildExperimentTask()
    })

  console.log(`[evals] Regression dataset: ${datasetName}`)
  console.log(`[evals] Regression experiment: ${experimentName}`)
  console.log(`[evals] Regression experiment ID: ${experiment.id}`)

  const thresholds = checkExperimentThresholds(
    experiment,
    config.scoreThreshold
  )
  console.log(
    `[evals] Regression pass rate: ${(thresholds.passRate * 100).toFixed(1)}% (${thresholds.passedEvaluations}/${thresholds.totalEvaluations})`
  )
  if (!thresholds.passed) {
    throw new Error(
      `[evals] Regression scores below threshold: ${(thresholds.passRate * 100).toFixed(1)}% < ${(config.scoreThreshold * 100).toFixed(1)}% (failing evaluators: ${thresholds.failedEvaluators.join(', ')})`
    )
  }
}
