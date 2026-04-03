import { openai } from '@ai-sdk/openai'

import { config } from '../config'
import { getCasesForEvaluation } from '../corpus'
import { runEvalCase } from '../eval-runner-client'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createDeterministicPrecheckEvaluator } from '../prechecks'
import type { EvalCase, EvalRunResult } from '../types'

import {
  buildDatasetExamples,
  buildExperimentEvaluators,
  buildExperimentTask,
  createDatasetAndExperiment
} from './shared'

export async function runRegressionSuite() {
  const cases = getCasesForEvaluation('regression')

  console.log(`[evals] Running regression suite with ${cases.length} cases`)

  const succeeded: Array<{ caseSpec: EvalCase; result: EvalRunResult }> = []
  let failCount = 0

  for (const caseSpec of cases) {
    try {
      const result = await runEvalCase(caseSpec, {
        evalRunnerUrl: config.evalRunnerUrl!,
        evalRunnerSecret: config.evalRunnerSecret!
      })
      succeeded.push({ caseSpec, result })
    } catch (error) {
      failCount++
      console.error(
        `[evals] Case ${caseSpec.id} failed:`,
        error instanceof Error ? error.message : error
      )
    }
  }

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
  const model = openai(config.judgeModel)
  const evaluators = buildExperimentEvaluators(
    createDeterministicPrecheckEvaluator,
    createFaithfulnessExperimentEvaluator,
    createRelevanceExperimentEvaluator,
    createResponseQualityExperimentEvaluator,
    model,
    {
      requiresTextAnswer: true,
      requiresCitations: successCases.some(c => c.requiresCitations),
      allowsInteractiveOnly: false
    }
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
}
