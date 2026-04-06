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

import { createConfig } from '../config'
import { getCasesForEvaluation, getCorpusVersion } from '../corpus'
import {
  extractPromptFromConversation,
  formatEvalContext
} from '../eval-output'
import { runEvalCase } from '../eval-runner-client'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createSafetyExperimentEvaluator } from '../evaluators/safety'
import { createToolUsageExperimentEvaluator } from '../evaluators/tool-usage'
import { createJudgeModel } from '../judge-model'
import { createDeterministicPrecheckEvaluator } from '../prechecks'
import { withRetry } from '../retry'
import type { EvalCase, EvalDatasetExample, EvalRunResult } from '../types'

export { createJudgeModel } from '../judge-model'

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

  const runtimeConfig = createConfig()
  const clientConfig = {
    evalRunnerUrl: runtimeConfig.evalRunnerUrl!,
    evalRunnerSecret: runtimeConfig.evalRunnerSecret!
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
  const runtimeConfig = createConfig()
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
  const evaluators = buildExperimentEvaluators({
    prechecks: createDeterministicPrecheckEvaluator,
    toolUsage: createToolUsageExperimentEvaluator,
    faithfulness: createFaithfulnessExperimentEvaluator,
    relevance: createRelevanceExperimentEvaluator,
    responseQuality: createResponseQualityExperimentEvaluator,
    safety: createSafetyExperimentEvaluator,
    model
  })

  const { datasetId, datasetName, experimentName, experiment } =
    await createDatasetAndExperiment({
      suite,
      examples,
      evaluators,
      task: buildExperimentTask()
    })

  console.log(`[evals] ${suite} dataset: ${datasetName}`)
  console.log(`[evals] ${suite} experiment: ${experimentName}`)
  console.log(`[evals] ${suite} experiment ID: ${experiment.id}`)
  console.log(
    `[evals] ${suite} view: ${buildPublicExperimentUrl(datasetId, experiment.id)}`
  )

  const thresholds = checkExperimentThresholds(
    experiment,
    runtimeConfig.scoreThreshold,
    ['safety']
  )
  console.log(
    `[evals] ${suite} pass rate: ${(thresholds.passRate * 100).toFixed(1)}% (${thresholds.passedEvaluations}/${thresholds.totalEvaluations})`
  )
  if (!thresholds.passed) {
    throw new Error(
      `[evals] ${suite} scores below threshold: ${(thresholds.passRate * 100).toFixed(1)}% < ${(runtimeConfig.scoreThreshold * 100).toFixed(1)}% (failing evaluators: ${thresholds.failedEvaluators.join(', ')})`
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

export interface EvaluatorFactories {
  prechecks: () => Evaluator
  toolUsage: () => Evaluator
  faithfulness: (model: LanguageModel) => Evaluator
  relevance: (model: LanguageModel) => Evaluator
  responseQuality: (model: LanguageModel) => Evaluator
  safety: (model: LanguageModel) => Evaluator
  model: LanguageModel
}

export function buildExperimentEvaluators(
  factories: EvaluatorFactories
): Evaluator[] {
  const {
    prechecks,
    toolUsage,
    faithfulness,
    relevance,
    responseQuality,
    safety,
    model
  } = factories
  return [
    prechecks(),
    toolUsage(),
    wrapEvaluatorWithRetry(faithfulness(model)),
    wrapEvaluatorWithRetry(relevance(model)),
    wrapEvaluatorWithRetry(responseQuality(model)),
    wrapEvaluatorWithRetry(safety(model))
  ]
}

export function createPhoenixClient() {
  const runtimeConfig = createConfig()
  return createClient({
    options: { baseUrl: runtimeConfig.phoenixHost }
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

export function buildPublicExperimentUrl(
  datasetId: string,
  experimentId: string
): string {
  const runtimeConfig = createConfig()
  const base = runtimeConfig.phoenixPublicUrl.replace(/\/$/, '')
  const encodedDatasetId = encodeURIComponent(datasetId)
  return `${base}/datasets/${encodedDatasetId}/compare?experimentId=${encodeURIComponent(experimentId)}`
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
  threshold: number,
  excludeFromThreshold: string[] = []
): ThresholdResult {
  const allRuns = experiment.evaluationRuns ?? []
  const runs = allRuns.filter(r => !excludeFromThreshold.includes(r.name))

  if (runs.length === 0) {
    return {
      passed: true,
      passRate: 1,
      totalEvaluations: 0,
      passedEvaluations: 0,
      failedEvaluators: []
    }
  }

  // Null scores (e.g. faithfulness returning 'skipped' for empty context)
  // are excluded from the denominator — they represent legitimately
  // inapplicable evaluations, not failures.
  const scoredRuns = runs.filter(
    r => r.error || !r.result || r.result.score != null
  )

  if (scoredRuns.length === 0) {
    return {
      passed: false,
      passRate: 0,
      totalEvaluations: 0,
      passedEvaluations: 0,
      failedEvaluators: []
    }
  }

  let passed = 0
  const failedByName = new Map<string, number>()

  for (const run of scoredRuns) {
    // Non-null assertion is safe: scoredRuns only includes runs where
    // run.error || !run.result || run.result.score != null, and the first
    // two conditions are checked before reaching score! via short-circuit.
    if (run.error || !run.result || run.result.score! < 0.5) {
      const count = failedByName.get(run.name) ?? 0
      failedByName.set(run.name, count + 1)
    } else {
      passed++
    }
  }

  const passRate = passed / scoredRuns.length

  return {
    passed: passRate >= threshold,
    passRate,
    totalEvaluations: scoredRuns.length,
    passedEvaluations: passed,
    failedEvaluators: [...failedByName.keys()]
  }
}