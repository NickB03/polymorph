import type { ExampleWithId } from '@arizeai/phoenix-client/types/datasets'
import type {
  ExperimentEvaluationRun,
  ExperimentRun,
  RanExperiment
} from '@arizeai/phoenix-client/types/experiments'
import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'

import { getCorpusVersion } from './corpus'
import { JUDGE_DEFAULT_SETTINGS } from './judge-model'
import type {
  EvalDatasetInput,
  EvalRunResult,
  PersistedEvalSuite
} from './types'

export const EVALUATOR_TEMPLATE_VERSION = 'v2'

export type EvalFailureMode =
  | 'retrieval_miss'
  | 'bad_citation'
  | 'unsafe_response'
  | 'tool_not_called'
  | 'tool_unnecessary'
  | 'answer_incomplete'
  | 'contradicts_context'
  | 'other'

interface EvalCaseResultInsert {
  id: string
  evalSummaryId: string
  suite: PersistedEvalSuite
  experimentName: string
  experimentRunId: string
  datasetExampleId: string | null
  caseId: string
  evaluatorName: string
  annotatorKind: string | null
  scoreBps: number | null
  label: string | null
  explanation: string | null
  error: string | null
  failed: boolean
  failureMode: EvalFailureMode
  appModelId: string | null
  modelType: string | null
  searchMode: string | null
  correlationId: string | null
  otelTraceId: string | null
  evaluatorTraceId: string | null
  phoenixUrl: string | null
}

type EvalSummaryExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

type EvalSummaryDb = EvalSummaryExecutor & {
  transaction: <T>(
    callback: (tx: EvalSummaryExecutor) => Promise<T>
  ) => Promise<T>
}

export function normalizeEvaluationRuns(experiment: RanExperiment) {
  return Array.isArray(experiment.evaluationRuns)
    ? experiment.evaluationRuns
    : []
}

export function computeEvaluatorAverages(
  runs: ExperimentEvaluationRun[]
): Record<string, number> {
  const groupedScores = new Map<string, number[]>()

  for (const run of runs) {
    if (run.error || !run.result || run.result.score == null) {
      continue
    }

    const existing = groupedScores.get(run.name) ?? []
    existing.push(run.result.score)
    groupedScores.set(run.name, existing)
  }

  return Object.fromEntries(
    [...groupedScores.entries()].map(([name, scores]) => [
      name,
      scores.reduce((total, score) => total + score, 0) / scores.length
    ])
  )
}

function clampPassRateBps(passRate: number) {
  return Math.max(0, Math.min(10000, Math.round(passRate * 10000)))
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asEvalRunResult(value: unknown): Partial<EvalRunResult> {
  return isRecord(value) ? (value as Partial<EvalRunResult>) : {}
}

function getRunOutput(run: ExperimentRun | undefined) {
  return asEvalRunResult(run?.output)
}

function getExampleInput(
  example: ExampleWithId | undefined
): Partial<EvalDatasetInput> {
  return isRecord(example?.input)
    ? (example.input as Partial<EvalDatasetInput>)
    : {}
}

function getExampleMetadata(
  example: ExampleWithId | undefined
): Record<string, unknown> {
  return isRecord(example?.metadata) ? example.metadata : {}
}

function getCaseId(params: {
  example: ExampleWithId | undefined
  run: ExperimentRun | undefined
  evalRun: ExperimentEvaluationRun
}) {
  const input = getExampleInput(params.example)
  const metadata = getExampleMetadata(params.example)
  return (
    nullableString(input.caseId) ??
    nullableString(metadata.caseId) ??
    nullableString(params.run?.datasetExampleId) ??
    params.evalRun.experimentRunId
  )
}

function getAppGitSha(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.APP_GIT_SHA ??
    env.GIT_SHA ??
    env.RAILWAY_GIT_COMMIT_SHA ??
    env.VERCEL_GIT_COMMIT_SHA ??
    null
  )
}

function collectAppModelIds(experiment: RanExperiment): string[] {
  const ids = new Set<string>()

  for (const run of Object.values(experiment.runs ?? {})) {
    const modelId = nullableString(getRunOutput(run).modelId)
    if (modelId) ids.add(modelId)
  }

  return [...ids].sort()
}

function getPrimaryAppModelId(appModelIds: string[]) {
  return appModelIds.length === 1 ? appModelIds[0] : null
}

function getScoreBps(score: number | null | undefined) {
  return score == null ? null : clampPassRateBps(score)
}

export function isFailedEvaluation(run: ExperimentEvaluationRun): boolean {
  if (run.error) return true
  if (!run.result) return false
  return run.result.score != null && run.result.score < 0.5
}

export function classifyFailureMode(params: {
  evaluatorName: string
  label: string | null
  explanation: string | null
  failed: boolean
}): EvalFailureMode {
  if (!params.failed) return 'other'

  const evaluator = params.evaluatorName
  const label = params.label?.toLowerCase() ?? ''
  const explanation = params.explanation?.toLowerCase() ?? ''
  const text = `${label} ${explanation}`

  if (evaluator === 'citation_accuracy' || text.includes('citation')) {
    return 'bad_citation'
  }

  if (
    evaluator === 'relevance' ||
    label.includes('no_results') ||
    text.includes('no search results') ||
    text.includes('retrieval')
  ) {
    return 'retrieval_miss'
  }

  if (
    evaluator === 'tool_usage' &&
    (label.includes('tools_missing') || text.includes('no search tools'))
  ) {
    return 'tool_not_called'
  }

  if (
    evaluator === 'tool_usage' &&
    (label.includes('tool_unnecessary') ||
      text.includes('unnecessary') ||
      text.includes('not required'))
  ) {
    return 'tool_unnecessary'
  }

  // tool_selection emits 'wrong' / 'missing' / 'correct' / 'not_required';
  // only the negative classes hit this fn (failed=true). Map onto the
  // existing EvalFailureMode union so the dashboard groups them correctly.
  if (evaluator === 'tool_selection') {
    if (label === 'missing') return 'tool_not_called'
    if (label === 'wrong') return 'tool_unnecessary'
  }

  if (evaluator === 'safety' || label.includes('unsafe')) {
    return 'unsafe_response'
  }

  if (
    evaluator === 'faithfulness' ||
    label.includes('unfaithful') ||
    text.includes('contradict') ||
    text.includes('hallucinat')
  ) {
    return 'contradicts_context'
  }

  if (
    evaluator === 'response_quality' ||
    evaluator === 'deterministic_prechecks' ||
    label.includes('no_answer') ||
    text.includes('incomplete') ||
    text.includes('missing')
  ) {
    return 'answer_incomplete'
  }

  return 'other'
}

export function buildEvalCaseResultRows(params: {
  summaryId: string
  suite: PersistedEvalSuite
  experimentName: string
  experiment: RanExperiment
  datasetExamples?: ExampleWithId[]
  phoenixUrl: string | null
}): EvalCaseResultInsert[] {
  const runs = params.experiment.runs ?? {}
  const examplesById = new Map(
    (params.datasetExamples ?? []).map(example => [example.id, example])
  )

  return normalizeEvaluationRuns(params.experiment)
    .map((evalRun): EvalCaseResultInsert | null => {
      const experimentRunId = nullableString(evalRun.experimentRunId)
      if (!experimentRunId) return null

      const run = runs[experimentRunId]
      const example = run?.datasetExampleId
        ? examplesById.get(run.datasetExampleId)
        : undefined
      const input = getExampleInput(example)
      const output = getRunOutput(run)
      const label = nullableString(evalRun.result?.label)
      const explanation = nullableString(evalRun.result?.explanation)
      const failed = isFailedEvaluation(evalRun)

      return {
        id: createId(),
        evalSummaryId: params.summaryId,
        suite: params.suite,
        experimentName: params.experimentName,
        experimentRunId,
        datasetExampleId: run?.datasetExampleId ?? null,
        caseId: getCaseId({ example, run, evalRun }),
        evaluatorName: evalRun.name,
        annotatorKind: nullableString(evalRun.annotatorKind),
        scoreBps: getScoreBps(evalRun.result?.score),
        label,
        explanation,
        error: nullableString(evalRun.error),
        failed,
        failureMode: classifyFailureMode({
          evaluatorName: evalRun.name,
          label,
          explanation,
          failed
        }),
        appModelId: nullableString(output.modelId),
        modelType: nullableString(input.modelType),
        searchMode: nullableString(input.searchMode),
        correlationId: nullableString(output.correlationId),
        otelTraceId:
          nullableString(output.otelTraceId) ?? nullableString(output.traceId),
        evaluatorTraceId: nullableString(evalRun.traceId),
        phoenixUrl: params.phoenixUrl
      }
    })
    .filter(
      (row): row is EvalCaseResultInsert =>
        row !== null && row.caseId.trim().length > 0
    )
}

function parseReturnedSummaryId(result: unknown): string | null {
  if (Array.isArray(result)) {
    const first = result[0]
    return isRecord(first) ? nullableString(first.id) : null
  }

  if (isRecord(result)) {
    const rows = result.rows
    if (Array.isArray(rows)) {
      const first = rows[0]
      return isRecord(first) ? nullableString(first.id) : null
    }
  }

  return null
}

function buildDetailInsertQuery(rows: EvalCaseResultInsert[]) {
  return sql`
    INSERT INTO eval_case_results (
      id,
      eval_summary_id,
      suite,
      experiment_name,
      experiment_run_id,
      dataset_example_id,
      case_id,
      evaluator_name,
      annotator_kind,
      score_bps,
      label,
      explanation,
      error,
      failed,
      failure_mode,
      app_model_id,
      model_type,
      search_mode,
      correlation_id,
      otel_trace_id,
      evaluator_trace_id,
      phoenix_url
    )
    VALUES ${sql.join(
      rows.map(
        row => sql`(
          ${row.id},
          ${row.evalSummaryId},
          ${row.suite},
          ${row.experimentName},
          ${row.experimentRunId},
          ${row.datasetExampleId},
          ${row.caseId},
          ${row.evaluatorName},
          ${row.annotatorKind},
          ${row.scoreBps},
          ${row.label},
          ${row.explanation},
          ${row.error},
          ${row.failed},
          ${row.failureMode},
          ${row.appModelId},
          ${row.modelType},
          ${row.searchMode},
          ${row.correlationId},
          ${row.otelTraceId},
          ${row.evaluatorTraceId},
          ${row.phoenixUrl}
        )`
      ),
      sql`, `
    )}
    ON CONFLICT (eval_summary_id, case_id, evaluator_name) DO UPDATE SET
      experiment_run_id = EXCLUDED.experiment_run_id,
      dataset_example_id = EXCLUDED.dataset_example_id,
      annotator_kind = EXCLUDED.annotator_kind,
      score_bps = EXCLUDED.score_bps,
      label = EXCLUDED.label,
      explanation = EXCLUDED.explanation,
      error = EXCLUDED.error,
      failed = EXCLUDED.failed,
      failure_mode = EXCLUDED.failure_mode,
      app_model_id = EXCLUDED.app_model_id,
      model_type = EXCLUDED.model_type,
      search_mode = EXCLUDED.search_mode,
      correlation_id = EXCLUDED.correlation_id,
      otel_trace_id = EXCLUDED.otel_trace_id,
      evaluator_trace_id = EXCLUDED.evaluator_trace_id,
      phoenix_url = EXCLUDED.phoenix_url
  `
}

export async function persistEvalSummary(
  db: EvalSummaryDb,
  params: {
    suite: PersistedEvalSuite
    experimentName: string
    datasetName: string
    passRate: number
    threshold: number
    thresholdBreached: boolean
    failedEvaluators: string[]
    experiment: RanExperiment
    totalCases: number
    attemptedCases: number
    failedCases: number
    phoenixUrl: string | null
    datasetExamples?: ExampleWithId[]
    datasetVersion?: string | null
    sampleSize?: number | null
    lookbackHours?: number | null
    judgeProvider?: string
    judgeModel?: string | null
    judgeBaseUrl?: string | null
    judgeSettings?: Record<string, unknown>
    corpusVersion?: string | null
    evaluatorTemplateVersion?: string
    appGitSha?: string | null
  }
) {
  const summaryId = createId()
  const evaluatorScores = computeEvaluatorAverages(
    normalizeEvaluationRuns(params.experiment)
  )
  const appModelIds = collectAppModelIds(params.experiment)
  const primaryAppModelId = getPrimaryAppModelId(appModelIds)
  const judgeSettings = params.judgeSettings ?? {
    ...JUDGE_DEFAULT_SETTINGS
  }

  await db.transaction(async tx => {
    const upsertResult = await tx.execute(sql`
      INSERT INTO eval_summaries (
        id,
        suite,
        experiment_name,
        dataset_name,
        pass_rate_bps,
        threshold_bps,
        threshold_breached,
        failed_evaluators,
        evaluator_scores,
        total_cases,
        attempted_cases,
        failed_cases,
        app_model_ids,
        primary_app_model_id,
        judge_provider,
        judge_model,
        judge_base_url,
        judge_settings,
        corpus_version,
        dataset_version,
        evaluator_template_version,
        app_git_sha,
        sample_size,
        lookback_hours,
        phoenix_url
      )
      VALUES (
        ${summaryId},
        ${params.suite},
        ${params.experimentName},
        ${params.datasetName},
        ${clampPassRateBps(params.passRate)},
        ${clampPassRateBps(params.threshold)},
        ${params.thresholdBreached},
        CAST(${JSON.stringify(params.failedEvaluators)} AS jsonb),
        CAST(${JSON.stringify(evaluatorScores)} AS jsonb),
        ${params.totalCases},
        ${params.attemptedCases},
        ${params.failedCases},
        CAST(${JSON.stringify(appModelIds)} AS jsonb),
        ${primaryAppModelId},
        ${params.judgeProvider ?? 'openrouter'},
        ${params.judgeModel ?? null},
        ${params.judgeBaseUrl ?? null},
        CAST(${JSON.stringify(judgeSettings)} AS jsonb),
        ${params.corpusVersion ?? getCorpusVersion()},
        ${params.datasetVersion ?? null},
        ${params.evaluatorTemplateVersion ?? EVALUATOR_TEMPLATE_VERSION},
        ${params.appGitSha ?? getAppGitSha()},
        ${params.sampleSize ?? null},
        ${params.lookbackHours ?? null},
        ${params.phoenixUrl}
      )
      ON CONFLICT (experiment_name) DO UPDATE SET
        pass_rate_bps = EXCLUDED.pass_rate_bps,
        threshold_bps = EXCLUDED.threshold_bps,
        threshold_breached = EXCLUDED.threshold_breached,
        failed_evaluators = EXCLUDED.failed_evaluators,
        evaluator_scores = EXCLUDED.evaluator_scores,
        total_cases = EXCLUDED.total_cases,
        attempted_cases = EXCLUDED.attempted_cases,
        failed_cases = EXCLUDED.failed_cases,
        app_model_ids = EXCLUDED.app_model_ids,
        primary_app_model_id = EXCLUDED.primary_app_model_id,
        judge_provider = EXCLUDED.judge_provider,
        judge_model = EXCLUDED.judge_model,
        judge_base_url = EXCLUDED.judge_base_url,
        judge_settings = EXCLUDED.judge_settings,
        corpus_version = EXCLUDED.corpus_version,
        dataset_version = EXCLUDED.dataset_version,
        evaluator_template_version = EXCLUDED.evaluator_template_version,
        app_git_sha = EXCLUDED.app_git_sha,
        sample_size = EXCLUDED.sample_size,
        lookback_hours = EXCLUDED.lookback_hours,
        phoenix_url = EXCLUDED.phoenix_url
      RETURNING id
    `)

    const persistedSummaryId = parseReturnedSummaryId(upsertResult) ?? summaryId
    const detailRows = buildEvalCaseResultRows({
      summaryId: persistedSummaryId,
      suite: params.suite,
      experimentName: params.experimentName,
      experiment: params.experiment,
      datasetExamples: params.datasetExamples,
      phoenixUrl: params.phoenixUrl
    })

    await tx.execute(sql`
      DELETE FROM eval_case_results
      WHERE eval_summary_id = ${persistedSummaryId}
    `)

    if (detailRows.length > 0) {
      await tx.execute(buildDetailInsertQuery(detailRows))
    }
  })
}
