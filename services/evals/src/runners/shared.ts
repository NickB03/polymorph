import { createOpenAI } from '@ai-sdk/openai'
import { createClient } from '@arizeai/phoenix-client'
import {
  createDataset,
  createOrGetDataset
} from '@arizeai/phoenix-client/datasets'
import { runExperiment } from '@arizeai/phoenix-client/experiments'
import type { Example } from '@arizeai/phoenix-client/types/datasets'
import type {
  Evaluator,
  ExperimentEvaluatorLike,
  ExperimentTask
} from '@arizeai/phoenix-client/types/experiments'
import type { LanguageModel } from 'ai'

import { config } from '../config'
import { getCasesForEvaluation, getCorpusVersion } from '../corpus'
import {
  extractPromptFromConversation,
  formatEvalContext
} from '../eval-output'
import { runEvalCase } from '../eval-runner-client'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createDeterministicPrecheckEvaluator } from '../prechecks'
import { withRetry } from '../retry'
import type { EvalCase, EvalDatasetExample, EvalRunResult } from '../types'

export function createJudgeModel(): LanguageModel {
  const provider = createOpenAI({
    ...(config.judgeBaseUrl && { baseURL: config.judgeBaseUrl }),
    ...(config.judgeApiKey && { apiKey: config.judgeApiKey })
  })
  return provider(config.judgeModel, {
    structuredOutputs: true
  }) as unknown as LanguageModel
}

const CASE_CONCURRENCY = 3

export interface CaseRunResults {
  succeeded: Array<{ caseSpec: EvalCase; result: EvalRunResult }>
  failCount: number
}

export async function runCasesConcurrently(
  cases: EvalCase[]
): Promise<CaseRunResults> {
  const succeeded: CaseRunResults['succeeded'] = []
  let failCount = 0

  const clientConfig = {
    evalRunnerUrl: config.evalRunnerUrl!,
    evalRunnerSecret: config.evalRunnerSecret!
  }

  const inFlight = new Set<Promise<void>>()

  for (const caseSpec of cases) {
    const task = (async () => {
      try {
        const result = await runEvalCase(caseSpec, clientConfig)
        succeeded.push({ caseSpec, result })
      } catch (error) {
        failCount++
        console.error(
          `[evals] Case ${caseSpec.id} failed:`,
          error instanceof Error ? error.message : error
        )
      }
    })()

    inFlight.add(task)
    task.finally(() => inFlight.delete(task))

    if (inFlight.size >= CASE_CONCURRENCY) {
      await Promise.race(inFlight)
    }
  }

  await Promise.all(inFlight)

  return { succeeded, failCount }
}

export async function runJudgedSuite(suite: 'capability' | 'regression') {
  const cases = getCasesForEvaluation(suite)

  console.log(`[evals] Running ${suite} suite with ${cases.length} cases`)

  const { succeeded, failCount } = await runCasesConcurrently(cases)

  if (succeeded.length === 0) {
    throw new Error(
      `[evals] All ${cases.length} ${suite} cases failed, aborting experiment`
    )
  }

  if (failCount > 0) {
    console.warn(
      `[evals] ${failCount}/${cases.length} ${suite} cases failed, recording partial results`
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
      suite,
      examples,
      evaluators,
      task: buildExperimentTask()
    })

  console.log(`[evals] ${suite} dataset: ${datasetName}`)
  console.log(`[evals] ${suite} experiment: ${experimentName}`)
  console.log(`[evals] ${suite} experiment ID: ${experiment.id}`)

  const thresholds = checkExperimentThresholds(
    experiment,
    config.scoreThreshold
  )
  console.log(
    `[evals] ${suite} pass rate: ${(thresholds.passRate * 100).toFixed(1)}% (${thresholds.passedEvaluations}/${thresholds.totalEvaluations})`
  )
  if (!thresholds.passed) {
    throw new Error(
      `[evals] ${suite} scores below threshold: ${(thresholds.passRate * 100).toFixed(1)}% < ${(config.scoreThreshold * 100).toFixed(1)}% (failing evaluators: ${thresholds.failedEvaluators.join(', ')})`
    )
  }
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

export function buildExperimentTask(): ExperimentTask {
  return async (example: Example) => example.output as unknown as EvalRunResult
}

function wrapEvaluatorWithRetry(evaluator: Evaluator): Evaluator {
  return {
    ...evaluator,
    evaluate: (args: Parameters<Evaluator['evaluate']>[0]) =>
      withRetry(() => Promise.resolve(evaluator.evaluate(args)), {
        maxAttempts: 3,
        baseDelayMs: 2000
      })
  }
}

export function buildExperimentEvaluators(
  createDeterministicPrecheckEvaluator: () => Evaluator,
  createFaithfulnessExperimentEvaluator: (model: LanguageModel) => Evaluator,
  createRelevanceExperimentEvaluator: (model: LanguageModel) => Evaluator,
  createResponseQualityExperimentEvaluator: (model: LanguageModel) => Evaluator,
  model: LanguageModel
): Evaluator[] {
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
  evaluators: ExperimentEvaluatorLike[]
  task: ExperimentTask
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
    examples: examples as unknown as Example[]
  })

  const experiment = await runExperiment({
    client: phoenix,
    experimentName,
    experimentDescription: `Automated eval of ${examples.length} ${suite} cases from corpus ${getCorpusVersion()}`,
    dataset: { datasetId },
    task,
    evaluators,
    concurrency: CASE_CONCURRENCY
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
