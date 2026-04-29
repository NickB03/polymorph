import { config as dotenvConfig } from 'dotenv'
import postgres from 'postgres'

dotenvConfig({ path: '.env.local', quiet: true })

export const LOCAL_SEED_PREFIX = 'local-seed-'
export const LOCAL_SEED_RESET_PATTERN = `${LOCAL_SEED_PREFIX}%`

type PersistedSuite = 'capability' | 'regression' | 'traffic-monitor'

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
        phoenixUrl: null,
        createdAt: new Date(now.getTime() - sequence * 60 * 60 * 1000)
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
  const databaseUrl = resolveDatabaseUrl()

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL is required')
  }

  assertLocalDatabaseUrl(databaseUrl)

  if (dryRun) {
    return {
      dryRun,
      reset,
      planned: rows.length,
      inserted: 0,
      rows
    }
  }

  const sql = postgres(databaseUrl, {
    ssl: process.env.DATABASE_SSL_DISABLED === 'true' ? false : false,
    prepare: false,
    max: 1
  })

  try {
    if (reset) {
      await sql`
        DELETE FROM eval_summaries
        WHERE experiment_name LIKE ${LOCAL_SEED_RESET_PATTERN}
      `
    }

    for (const row of rows) {
      await sql`
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
          phoenix_url = EXCLUDED.phoenix_url,
          created_at = EXCLUDED.created_at
      `
    }
  } finally {
    await sql.end()
  }

  return {
    dryRun,
    reset,
    planned: rows.length,
    inserted: rows.length,
    rows
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
