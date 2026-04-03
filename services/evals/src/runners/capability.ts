import { openai } from '@ai-sdk/openai'

import { config } from '../config'
import { getCasesForEvaluation } from '../corpus'
import { runEvalCase } from '../eval-runner-client'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createDeterministicPrecheckEvaluator } from '../prechecks'

import {
  buildDatasetExamples,
  buildExperimentEvaluators,
  buildExperimentTask,
  createDatasetAndExperiment
} from './shared'

export async function runCapabilitySuite() {
  const cases = getCasesForEvaluation('capability')

  console.log(`[evals] Running capability suite with ${cases.length} cases`)

  const results = []
  for (const caseSpec of cases) {
    const result = await runEvalCase(caseSpec, {
      evalRunnerUrl: config.evalRunnerUrl!,
      evalRunnerSecret: config.evalRunnerSecret!
    })
    results.push({
      ...result,
      citations: result.citations,
      searchResults: result.searchResults
    })
  }

  const examples = buildDatasetExamples(cases, results)
  const model = openai(config.judgeModel)
  const evaluators = buildExperimentEvaluators(
    createDeterministicPrecheckEvaluator,
    createFaithfulnessExperimentEvaluator,
    createRelevanceExperimentEvaluator,
    createResponseQualityExperimentEvaluator,
    model,
    {
      requiresTextAnswer: true,
      requiresCitations: cases.some(caseSpec => caseSpec.requiresCitations),
      allowsInteractiveOnly: false
    }
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
}
