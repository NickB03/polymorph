import { createOpenAI } from '@ai-sdk/openai'
import { createClient } from '@arizeai/phoenix-client'
import {
  createDataset,
  createOrGetDataset
} from '@arizeai/phoenix-client/datasets'
import { runExperiment } from '@arizeai/phoenix-client/experiments'

import { config } from '../config'
import { getCorpusVersion } from '../corpus'
import {
  extractPromptFromConversation,
  formatEvalContext
} from '../eval-output'
import { withRetry } from '../retry'
import type { EvalCase, EvalDatasetExample, EvalRunResult } from '../types'

export function createJudgeModel() {
  const provider = createOpenAI({
    ...(config.judgeBaseUrl && { baseURL: config.judgeBaseUrl }),
    ...(config.judgeApiKey && { apiKey: config.judgeApiKey })
  })
  return provider(config.judgeModel, { structuredOutputs: true })
}

export function buildTimestampedExperimentName(suite: string): string {
  const timestamp = new Date().toISOString().slice(0, 13).replace('T', '-')
  return `polymorph-${suite}-${timestamp}h`
}

export function buildStableDatasetName(suite: string): string {
  return `polymorph-${suite}-${getCorpusVersion()}`
}

export function buildTimestampedDatasetName(suite: string): string {
  const timestamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(':', '-')
  return `polymorph-${suite}-${timestamp}`
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

function wrapEvaluatorWithRetry(evaluator: {
  name: string
  kind: string
  evaluate: (args: any) => Promise<any> | any
}) {
  return {
    ...evaluator,
    evaluate: (args: any) =>
      withRetry(() => Promise.resolve(evaluator.evaluate(args)), {
        maxAttempts: 3,
        baseDelayMs: 2000
      })
  }
}

export function buildExperimentEvaluators(
  createDeterministicPrecheckEvaluator: () => any,
  createFaithfulnessExperimentEvaluator: (model: any) => any,
  createRelevanceExperimentEvaluator: (model: any) => any,
  createResponseQualityExperimentEvaluator: (model: any) => any,
  model: any
) {
  return [
    createDeterministicPrecheckEvaluator(),
    wrapEvaluatorWithRetry(createFaithfulnessExperimentEvaluator(model)),
    wrapEvaluatorWithRetry(createRelevanceExperimentEvaluator(model)),
    wrapEvaluatorWithRetry(createResponseQualityExperimentEvaluator(model))
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
  task,
  datasetName: datasetNameOverride
}: {
  suite: string
  examples: EvalDatasetExample[]
  evaluators: unknown[]
  task: (example: { output: EvalRunResult }) => Promise<EvalRunResult>
  datasetName?: string
}) {
  const phoenix = createPhoenixClient()
  const datasetName = datasetNameOverride ?? buildStableDatasetName(suite)
  const experimentName = buildTimestampedExperimentName(suite)
  const createFn = datasetNameOverride ? createDataset : createOrGetDataset

  const { datasetId } = await createFn({
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

export interface ThresholdResult {
  passed: boolean
  passRate: number
  totalEvaluations: number
  passedEvaluations: number
  failedEvaluators: string[]
}

export function checkExperimentThresholds(
  experiment: {
    evaluationRuns?: Array<{
      name: string
      error: string | null
      result: { score?: number | null; label?: string | null } | null
    }>
  },
  threshold: number
): ThresholdResult {
  const runs = experiment.evaluationRuns ?? []
  if (runs.length === 0) {
    return {
      passed: true,
      passRate: 1,
      totalEvaluations: 0,
      passedEvaluations: 0,
      failedEvaluators: []
    }
  }

  let passed = 0
  const failedByName = new Map<string, number>()

  for (const run of runs) {
    if (
      run.error ||
      !run.result ||
      run.result.score == null ||
      run.result.score < 0.5
    ) {
      const count = failedByName.get(run.name) ?? 0
      failedByName.set(run.name, count + 1)
    } else {
      passed++
    }
  }

  const passRate = passed / runs.length

  return {
    passed: passRate >= threshold,
    passRate,
    totalEvaluations: runs.length,
    passedEvaluations: passed,
    failedEvaluators: [...failedByName.keys()]
  }
}
