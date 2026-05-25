import { config as dotenvConfig } from 'dotenv'
import postgres from 'postgres'

import { createJudgeConfig } from '../services/evals/src/judge-config'

dotenvConfig({ path: '.env.local', quiet: true })

export const LOCAL_SEED_PREFIX = 'local-seed-'
export const LOCAL_SEED_RESET_PATTERN = `${LOCAL_SEED_PREFIX}%`

type PersistedSuite = 'capability' | 'regression' | 'traffic-monitor'
type SeedFailureMode =
  | 'retrieval_miss'
  | 'bad_citation'
  | 'unsafe_response'
  | 'tool_not_called'
  | 'tool_unnecessary'
  | 'answer_incomplete'
  | 'contradicts_context'
  | 'other'

export type SeedEvalSummaryRow = {
  suite: PersistedSuite
  experimentName: string
  datasetName: string
  passRateBps: number
  thresholdBps: number
  thresholdBreached: boolean
  failedEvaluators: string[]
  evaluatorScores: Record<string, number | null>
  totalCases: number
  attemptedCases: number
  failedCases: number
  appModelIds: string[]
  primaryAppModelId: string | null
  judgeProvider: string
  judgeModel: string | null
  judgeBaseUrl: string | null
  judgeSettings: Record<string, unknown>
  corpusVersion: string | null
  datasetVersion: string | null
  evaluatorTemplateVersion: string
  appGitSha: string | null
  sampleSize: number | null
  lookbackHours: number | null
  phoenixUrl: string | null
  createdAt: Date
}

export type SeedEvalCaseResultRow = {
  id: string
  evalSummaryId: string
  suite: PersistedSuite
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
  failureMode: SeedFailureMode
  appModelId: string | null
  modelType: string | null
  searchMode: string | null
  correlationId: string | null
  otelTraceId: string | null
  evaluatorTraceId: string | null
  phoenixUrl: string | null
  createdAt: Date
}

type SeedOptions = {
  dryRun?: boolean
  reset?: boolean
  now?: Date
}

const SUITE_ORDER: PersistedSuite[] = [
  'traffic-monitor',
  'regression',
  'capability'
]

function buildSeedJudgeMetadata() {
  const judgeConfig = createJudgeConfig()

  return {
    judgeProvider: 'openrouter',
    judgeModel: judgeConfig.judgeModel,
    judgeBaseUrl: judgeConfig.judgeBaseUrl ?? null,
    judgeSettings: {
      temperature: 0,
      topP: 1,
      reasoning: {
        enabled: judgeConfig.judgeReasoningEnabled,
        maxTokens: judgeConfig.judgeReasoningMaxTokens
      }
    }
  }
}

const FAILURE_MODE_BY_EVALUATOR: Record<string, SeedFailureMode> = {
  faithfulness: 'contradicts_context',
  citation_accuracy: 'bad_citation',
  safety: 'unsafe_response',
  tool_usage: 'tool_not_called',
  tool_selection: 'tool_not_called',
  relevance: 'retrieval_miss',
  response_quality: 'answer_incomplete',
  deterministic_prechecks: 'answer_incomplete'
}

const SUITE_FIXTURES: Record<
  PersistedSuite,
  {
    datasetName: string
    totalCases: number
    scores: Array<{
      passRateBps: number
      evaluatorScores: Record<string, number | null>
      failedEvaluators?: string[]
      failedCases?: number
    }>
  }
> = {
  capability: {
    datasetName: 'local-seed-capability-v1',
    totalCases: 24,
    scores: [
      {
        passRateBps: 9400,
        evaluatorScores: {
          deterministic_prechecks: 1,
          tool_usage: 0.95,
          tool_selection: 0.93,
          faithfulness: 0.91,
          relevance: 0.93,
          response_quality: 0.92,
          safety: 0.98,
          citation_accuracy: 0.82
        }
      },
      {
        passRateBps: 9000,
        evaluatorScores: {
          deterministic_prechecks: 1,
          tool_usage: 0.9,
          tool_selection: 0.87,
          faithfulness: 0.86,
          relevance: 0.9,
          response_quality: 0.88,
          safety: 1,
          citation_accuracy: 0.76
        }
      },
      {
        passRateBps: 8600,
        evaluatorScores: {
          deterministic_prechecks: 0.96,
          tool_usage: 0.88,
          tool_selection: 0.84,
          faithfulness: 0.84,
          relevance: 0.87,
          response_quality: 0.85,
          safety: 0.96,
          citation_accuracy: 0.72
        }
      },
      {
        passRateBps: 7900,
        evaluatorScores: {
          deterministic_prechecks: 0.92,
          tool_usage: 0.82,
          tool_selection: 0.72,
          faithfulness: 0.77,
          relevance: 0.8,
          response_quality: 0.78,
          safety: 0.96,
          citation_accuracy: 0.68
        },
        failedEvaluators: ['faithfulness', 'citation_accuracy'],
        failedCases: 3
      }
    ]
  },
  regression: {
    datasetName: 'local-seed-regression-v1',
    totalCases: 3,
    scores: [
      {
        passRateBps: 10000,
        evaluatorScores: {
          deterministic_prechecks: 1,
          tool_usage: 1,
          tool_selection: 1,
          faithfulness: 1,
          relevance: 1,
          response_quality: 0.94,
          safety: 1,
          citation_accuracy: 0.83
        }
      },
      {
        passRateBps: 9300,
        evaluatorScores: {
          deterministic_prechecks: 1,
          tool_usage: 1,
          tool_selection: 0.95,
          faithfulness: 0.95,
          relevance: 0.92,
          response_quality: 0.88,
          safety: 1,
          citation_accuracy: 0.78
        }
      },
      {
        passRateBps: 8800,
        evaluatorScores: {
          deterministic_prechecks: 1,
          tool_usage: 0.9,
          tool_selection: 0.91,
          faithfulness: 0.86,
          relevance: 0.9,
          response_quality: 0.86,
          safety: 1,
          citation_accuracy: 0.74
        }
      },
      {
        passRateBps: 7600,
        evaluatorScores: {
          deterministic_prechecks: 0.9,
          tool_usage: 0.85,
          tool_selection: 0.78,
          faithfulness: 0.74,
          relevance: 0.78,
          response_quality: 0.72,
          safety: 0.97,
          citation_accuracy: 0.67
        },
        failedEvaluators: ['response_quality'],
        failedCases: 1
      }
    ]
  },
  'traffic-monitor': {
    datasetName: 'local-seed-traffic-monitor-v1',
    totalCases: 10,
    scores: [
      {
        passRateBps: 9300,
        evaluatorScores: {
          deterministic_prechecks: 1,
          tool_usage: 0.92,
          tool_selection: 0.9,
          faithfulness: 0.9,
          relevance: 0.88,
          response_quality: 0.9,
          safety: 0.96,
          citation_accuracy: null
        }
      },
      {
        passRateBps: 8700,
        evaluatorScores: {
          deterministic_prechecks: 1,
          tool_usage: 0.86,
          tool_selection: 0.84,
          faithfulness: 0.86,
          relevance: 0.82,
          response_quality: 0.84,
          safety: 0.94,
          citation_accuracy: null
        },
        failedCases: 1
      },
      {
        passRateBps: 8100,
        evaluatorScores: {
          deterministic_prechecks: 0.95,
          tool_usage: 0.8,
          tool_selection: 0.78,
          faithfulness: 0.82,
          relevance: 0.78,
          response_quality: 0.82,
          safety: 0.92,
          citation_accuracy: null
        },
        failedCases: 2
      },
      {
        passRateBps: 7200,
        evaluatorScores: {
          deterministic_prechecks: 0.9,
          tool_usage: 0.72,
          tool_selection: 0.68,
          faithfulness: 0.76,
          relevance: 0.7,
          response_quality: 0.74,
          safety: 0.88,
          citation_accuracy: null
        },
        failedEvaluators: ['relevance', 'replay-drop-rate'],
        failedCases: 6
      }
    ]
  }
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.DATABASE_URL ?? env.POSTGRES_URL ?? null
}

export function assertLocalDatabaseUrl(databaseUrl: string) {
  let parsed: URL

  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid postgres URL')
  }

  const host = parsed.hostname.toLowerCase()
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]'

  if (!isLocal) {
    throw new Error(
      `Refusing to seed eval_summaries on non-local database host: ${parsed.hostname}`
    )
  }
}

export function buildSeedEvalSummaryRows(
  now = new Date()
): SeedEvalSummaryRow[] {
  const rows: SeedEvalSummaryRow[] = []
  const judgeMetadata = buildSeedJudgeMetadata()

  for (let runIndex = 0; runIndex < 4; runIndex++) {
    for (let suiteIndex = 0; suiteIndex < SUITE_ORDER.length; suiteIndex++) {
      const suite = SUITE_ORDER[suiteIndex]
      const fixture = SUITE_FIXTURES[suite]
      const score = fixture.scores[runIndex]
      const sequence = runIndex * SUITE_ORDER.length + suiteIndex
      const thresholdBreached = score.passRateBps < 8000

      rows.push({
        suite,
        experimentName: `${LOCAL_SEED_PREFIX}${suite}-${runIndex + 1}`,
        datasetName: fixture.datasetName,
        passRateBps: score.passRateBps,
        thresholdBps: 8000,
        thresholdBreached,
        failedEvaluators: score.failedEvaluators ?? [],
        evaluatorScores: score.evaluatorScores,
        totalCases: fixture.totalCases,
        attemptedCases: fixture.totalCases,
        failedCases: score.failedCases ?? 0,
        appModelIds:
          suite === 'traffic-monitor'
            ? ['claude-3.5-sonnet', 'gpt-4.1-mini']
            : ['gpt-4.1-mini'],
        primaryAppModelId: suite === 'traffic-monitor' ? null : 'gpt-4.1-mini',
        judgeProvider: judgeMetadata.judgeProvider,
        judgeModel: judgeMetadata.judgeModel,
        judgeBaseUrl: judgeMetadata.judgeBaseUrl,
        judgeSettings: judgeMetadata.judgeSettings,
        corpusVersion: 'v6',
        datasetVersion: `${fixture.datasetName}-version`,
        evaluatorTemplateVersion: 'v1',
        appGitSha: 'local-seed',
        sampleSize: fixture.totalCases,
        lookbackHours: suite === 'traffic-monitor' ? 48 : null,
        phoenixUrl: null,
        createdAt: new Date(now.getTime() - sequence * 60 * 60 * 1000)
      })
    }
  }

  return rows
}

function getSeedEvaluatorForFailure(row: SeedEvalSummaryRow) {
  const explicit = row.failedEvaluators.find(
    evaluator => row.evaluatorScores[evaluator] != null
  )
  if (explicit) return explicit

  return Object.entries(row.evaluatorScores)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((left, right) => left[1] - right[1])[0]?.[0]
}

export function buildSeedEvalCaseResultRows(
  summaryRows: SeedEvalSummaryRow[]
): SeedEvalCaseResultRow[] {
  const rows: SeedEvalCaseResultRow[] = []

  for (const summary of summaryRows) {
    const count = Math.min(summary.failedCases, 3)
    if (count === 0) continue

    const evaluatorName = getSeedEvaluatorForFailure(summary)
    if (!evaluatorName) continue

    const failureMode = FAILURE_MODE_BY_EVALUATOR[evaluatorName] ?? 'other'
    const score = summary.evaluatorScores[evaluatorName]
    const scoreBps =
      typeof score === 'number'
        ? Math.max(0, Math.min(10000, Math.round(score * 10000)))
        : null

    for (let index = 0; index < count; index++) {
      const caseId = `${summary.experimentName}-case-${index + 1}`
      rows.push({
        id: `${summary.experimentName}-${evaluatorName}-${index + 1}`,
        evalSummaryId: summary.experimentName,
        suite: summary.suite,
        experimentName: summary.experimentName,
        experimentRunId: `${summary.experimentName}-run-${index + 1}`,
        datasetExampleId: `${summary.experimentName}-example-${index + 1}`,
        caseId,
        evaluatorName,
        annotatorKind:
          evaluatorName === 'deterministic_prechecks' ? 'rule' : 'llm',
        scoreBps,
        label: failureMode,
        explanation: `Seeded diagnostic for ${caseId}: ${failureMode.replaceAll('_', ' ')} affected this case.`,
        error: null,
        failed: true,
        failureMode,
        appModelId: summary.primaryAppModelId ?? summary.appModelIds[0] ?? null,
        modelType: summary.suite === 'traffic-monitor' ? 'production' : 'test',
        searchMode: 'auto',
        correlationId: `${caseId}-correlation`,
        otelTraceId: `${caseId}-trace`,
        evaluatorTraceId: `${caseId}-judge-trace`,
        phoenixUrl: summary.phoenixUrl,
        createdAt: summary.createdAt
      })
    }
  }

  return rows
}

export function getSeedResetPattern() {
  return LOCAL_SEED_RESET_PATTERN
}

export async function seedEvalSummaries({
  dryRun = true,
  reset = false,
  now = new Date()
}: SeedOptions = {}) {
  const rows = buildSeedEvalSummaryRows(now)
  const caseRows = buildSeedEvalCaseResultRows(rows)
  if (dryRun) {
    return {
      dryRun,
      reset,
      planned: rows.length,
      inserted: 0,
      rows,
      caseRows
    }
  }

  const databaseUrl = resolveDatabaseUrl()

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL is required')
  }

  assertLocalDatabaseUrl(databaseUrl)

  const sql = postgres(databaseUrl, {
    // This script is guarded to local database hosts only.
    ssl: false,
    prepare: false,
    max: 1
  })

  try {
    await sql.begin(async tx => {
      const trx = tx as unknown as typeof sql

      if (reset) {
        await trx`
          DELETE FROM eval_summaries
          WHERE experiment_name LIKE ${LOCAL_SEED_RESET_PATTERN}
        `
      }

      await trx`
        DELETE FROM eval_case_results
        WHERE eval_summary_id LIKE ${LOCAL_SEED_RESET_PATTERN}
      `

      for (const row of rows) {
        await trx`
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
            phoenix_url,
            created_at
          )
          VALUES (
            ${row.experimentName},
            ${row.suite},
            ${row.experimentName},
            ${row.datasetName},
            ${row.passRateBps},
            ${row.thresholdBps},
            ${row.thresholdBreached},
            CAST(${JSON.stringify(row.failedEvaluators)} AS jsonb),
            CAST(${JSON.stringify(row.evaluatorScores)} AS jsonb),
            ${row.totalCases},
            ${row.attemptedCases},
            ${row.failedCases},
            CAST(${JSON.stringify(row.appModelIds)} AS jsonb),
            ${row.primaryAppModelId},
            ${row.judgeProvider},
            ${row.judgeModel},
            ${row.judgeBaseUrl},
            CAST(${JSON.stringify(row.judgeSettings)} AS jsonb),
            ${row.corpusVersion},
            ${row.datasetVersion},
            ${row.evaluatorTemplateVersion},
            ${row.appGitSha},
            ${row.sampleSize},
            ${row.lookbackHours},
            ${row.phoenixUrl},
            ${row.createdAt}
          )
          ON CONFLICT (experiment_name) DO UPDATE SET
            dataset_name = EXCLUDED.dataset_name,
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
            phoenix_url = EXCLUDED.phoenix_url,
            created_at = EXCLUDED.created_at
        `
      }

      for (const row of caseRows) {
        await trx`
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
            phoenix_url,
            created_at
          )
          VALUES (
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
            ${row.phoenixUrl},
            ${row.createdAt}
          )
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
            phoenix_url = EXCLUDED.phoenix_url,
            created_at = EXCLUDED.created_at
        `
      }
    })
  } finally {
    await sql.end()
  }

  return {
    dryRun,
    reset,
    planned: rows.length,
    inserted: rows.length,
    rows,
    caseRows
  }
}

function printSummary(result: Awaited<ReturnType<typeof seedEvalSummaries>>) {
  const mode = result.dryRun ? 'Planned' : 'Seeded'
  console.log(
    `${mode} ${result.planned} local eval summary rows${result.reset ? ' after reset' : ''}.`
  )
  console.table(
    result.rows.map(row => ({
      suite: row.suite,
      experiment: row.experimentName,
      passRate: `${(row.passRateBps / 100).toFixed(1)}%`,
      thresholdBreached: row.thresholdBreached,
      failedCases: row.failedCases,
      createdAt: row.createdAt.toISOString()
    }))
  )
}

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes('--dry-run') || !argv.includes('--write'),
    reset: argv.includes('--reset')
  }
}

const bunImportMeta = import.meta as ImportMeta & { main?: boolean }

if (bunImportMeta.main) {
  seedEvalSummaries(parseArgs(process.argv.slice(2)))
    .then(printSummary)
    .catch(error => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
