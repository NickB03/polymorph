import { gateway } from '@ai-sdk/gateway'
import { createClient } from '@arizeai/phoenix-client'
import { createOrGetDataset } from '@arizeai/phoenix-client/datasets'
import { runExperiment } from '@arizeai/phoenix-client/experiments'

import { config } from '../config'
import { getCorpusVersion } from '../corpus'
import {
  extractPromptFromConversation,
  formatEvalContext
} from '../eval-output'
import type { EvalCase, EvalDatasetExample, EvalRunResult } from '../types'

export function createJudgeModel() {
  return gateway(config.judgeModel)
}

export function buildTimestampedExperimentName(suite: string): string {
  const timestamp = new Date().toISOString().slice(0, 13).replace('T', '-')
  return `polymorph-${suite}-${timestamp}h`
}

export function buildStableDatasetName(suite: string): string {
  return `polymorph-${suite}-${getCorpusVersion()}`
}

export function buildDatasetExamples(
  cases: EvalCase[],
  results: EvalRunResult[]
): EvalDatasetExample[] {
  return cases.map((caseSpec, index) => {
    const output = results[index]
    if (!output) {
      throw new Error(`Missing eval result for case ${caseSpec.id}`)
    }
    const prompt = extractPromptFromConversation(caseSpec.conversation)
    const context = formatEvalContext(output)

    return {
      input: {
        caseId: caseSpec.id,
        suite: caseSpec.suite,
        conversation: caseSpec.conversation,
        searchMode: caseSpec.searchMode,
        modelType: caseSpec.modelType,
        prompt,
        query: prompt,
        context,
        tags: caseSpec.tags
      },
      output,
      metadata: {
        caseId: caseSpec.id,
        suite: caseSpec.suite,
        tags: caseSpec.tags,
        corpusVersion: getCorpusVersion(),
        requiresTextAnswer: caseSpec.requiresTextAnswer,
        requiresCitations: caseSpec.requiresCitations,
        allowsInteractiveOnly: caseSpec.allowsInteractiveOnly
      }
    }
  })
}

export function buildExperimentTask() {
  return async (example: { output: EvalRunResult }) => example.output
}

export function buildExperimentEvaluators(
  createDeterministicPrecheckEvaluator: (requirements: {
    requiresTextAnswer: boolean
    requiresCitations: boolean
    allowsInteractiveOnly: boolean
  }) => any,
  createFaithfulnessExperimentEvaluator: (model: any) => any,
  createRelevanceExperimentEvaluator: (model: any) => any,
  createResponseQualityExperimentEvaluator: (model: any) => any,
  model: any,
  requirements: {
    requiresTextAnswer: boolean
    requiresCitations: boolean
    allowsInteractiveOnly: boolean
  }
) {
  return [
    createDeterministicPrecheckEvaluator(requirements),
    createFaithfulnessExperimentEvaluator(model),
    createRelevanceExperimentEvaluator(model),
    createResponseQualityExperimentEvaluator(model)
  ]
}

export function createPhoenixClient() {
  return createClient({
    options: { baseUrl: config.phoenixHost }
  })
}

export async function createDatasetAndExperiment({
  suite,
  examples,
  evaluators,
  task
}: {
  suite: string
  examples: EvalDatasetExample[]
  evaluators: unknown[]
  task: (example: { output: EvalRunResult }) => Promise<EvalRunResult>
}) {
  const phoenix = createPhoenixClient()
  const datasetName = buildStableDatasetName(suite)
  const experimentName = buildTimestampedExperimentName(suite)

  const { datasetId } = await createOrGetDataset({
    client: phoenix,
    name: datasetName,
    description: `Automated eval of ${examples.length} ${suite} cases from corpus ${getCorpusVersion()}`,
    examples: examples as any
  })

  const experiment = await runExperiment({
    client: phoenix,
    experimentName,
    experimentDescription: `Automated eval of ${examples.length} ${suite} cases from corpus ${getCorpusVersion()}`,
    dataset: { datasetId },
    task: task as any,
    evaluators: evaluators as any[],
    concurrency: 3
  })

  return { datasetId, experiment, experimentName, datasetName }
}

export function formatCaseContext(result: EvalRunResult): string {
  return formatEvalContext(result)
}
