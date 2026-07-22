import { DEFAULT_EVAL_RUNNER_TIMEOUT_MS } from './eval-runner-client'
import {
  createJudgeConfig,
  validBool,
  validInt,
  validPositiveInt
} from './judge-config'
import type { EvalRunMode } from './types'

// Environment configuration for the evals service.
// Phoenix client reads PHOENIX_HOST and PHOENIX_API_KEY from env automatically.

export interface EvalsConfig {
  databaseUrl: string
  phoenixHost: string
  phoenixPublicUrl: string
  phoenixApiKey: string
  judgeModel: string
  judgeBaseUrl?: string
  judgeApiKey?: string
  judgeReasoningEnabled: boolean
  judgeReasoningMaxTokens: number
  sampleSize: number
  lookbackHours: number
  databaseSslDisabled: boolean
  evalRunMode: EvalRunMode
  caseIds: string[]
  evalRunnerUrl?: string
  evalRunnerSecret?: string
  evalRunnerTimeoutMs: number
  appUrl?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  seedUserEmail?: string
  seedUserPassword?: string
  smokeEnabled: boolean
  smokeCaseCount: number
  smokeTimeoutMs: number
  scoreThreshold: number
  exitOnThresholdBreach: boolean
  caseConcurrency: number
  dbPoolMax: number
  excludeFromThreshold: string[]
}

export interface CreateConfigOptions {
  validateRunnerSettings?: boolean
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function validFloat(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseFloat(raw)
  return Number.isNaN(n) ? fallback : n
}

function validStringList(raw: string | undefined): string[] {
  if (!raw) return []

  return [
    ...new Set(
      raw
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
    )
  ]
}

function parseRunMode(raw: string | undefined): EvalRunMode {
  switch (raw) {
    case 'capability':
    case 'regression':
    case 'traffic-monitor':
    case 'smoke':
    case 'all':
      return raw
    default:
      return 'capability'
  }
}

function requiredEvalRunnerSettings(mode: EvalRunMode): boolean {
  return (
    mode === 'capability' ||
    mode === 'regression' ||
    mode === 'traffic-monitor' ||
    mode === 'all'
  )
}

function requiredSmokeSettings(
  mode: EvalRunMode,
  smokeEnabled: boolean
): boolean {
  return mode === 'smoke' || (mode === 'all' && smokeEnabled)
}

export function createConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: CreateConfigOptions = { validateRunnerSettings: true }
): EvalsConfig {
  const evalRunMode = parseRunMode(env.EVAL_RUN_MODE)
  const smokeEnabled = validBool(env.SMOKE_ENABLED, true)
  const needsEvalRunner =
    options.validateRunnerSettings !== false &&
    requiredEvalRunnerSettings(evalRunMode)
  const needsSmokeSettings =
    options.validateRunnerSettings !== false &&
    requiredSmokeSettings(evalRunMode, smokeEnabled)
  const evalRunnerUrl = env.EVAL_RUNNER_URL?.trim()
  const evalRunnerSecret = env.EVAL_RUNNER_SECRET?.trim()
  const appUrl = env.APP_URL?.trim() || evalRunnerUrl
  const supabaseUrl = env.SUPABASE_URL?.trim()
  const supabaseAnonKey = env.SUPABASE_ANON_KEY?.trim()
  const seedUserEmail = env.SEED_USER_EMAIL?.trim()
  const seedUserPassword = env.SEED_USER_PASSWORD?.trim()

  if (needsEvalRunner && !evalRunnerUrl) {
    throw new Error('Missing required env var: EVAL_RUNNER_URL')
  }

  if (needsEvalRunner && !evalRunnerSecret) {
    throw new Error('Missing required env var: EVAL_RUNNER_SECRET')
  }

  if (needsSmokeSettings && !appUrl) {
    throw new Error('Missing required env var: APP_URL')
  }

  if (needsSmokeSettings && !supabaseUrl) {
    throw new Error('Missing required env var: SUPABASE_URL')
  }

  if (needsSmokeSettings && !supabaseAnonKey) {
    throw new Error('Missing required env var: SUPABASE_ANON_KEY')
  }

  if (needsSmokeSettings && !seedUserEmail) {
    throw new Error('Missing required env var: SEED_USER_EMAIL')
  }

  if (needsSmokeSettings && !seedUserPassword) {
    throw new Error('Missing required env var: SEED_USER_PASSWORD')
  }

  const phoenixHost = required(env, 'PHOENIX_HOST')

  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    phoenixHost,
    phoenixPublicUrl: env.PHOENIX_PUBLIC_URL?.trim() || phoenixHost,
    phoenixApiKey: required(env, 'PHOENIX_API_KEY'),
    ...createJudgeConfig(env),
    sampleSize: validInt(env.SAMPLE_SIZE, 10),
    lookbackHours: validInt(env.LOOKBACK_HOURS, 48),
    databaseSslDisabled: env.DATABASE_SSL_DISABLED === 'true',
    evalRunMode,
    caseIds: validStringList(env.EVAL_CASE_IDS),
    evalRunnerUrl,
    evalRunnerSecret,
    evalRunnerTimeoutMs: validPositiveInt(
      env.EVAL_RUNNER_TIMEOUT_MS,
      DEFAULT_EVAL_RUNNER_TIMEOUT_MS
    ),
    appUrl,
    supabaseUrl,
    supabaseAnonKey,
    seedUserEmail,
    seedUserPassword,
    smokeEnabled,
    smokeCaseCount: validInt(env.SMOKE_CASE_COUNT, 1),
    smokeTimeoutMs: validInt(env.SMOKE_TIMEOUT_MS, 300_000),
    scoreThreshold: validFloat(env.SCORE_THRESHOLD, 0.8),
    exitOnThresholdBreach: validBool(env.EVAL_EXIT_ON_THRESHOLD_BREACH, false),
    caseConcurrency: validInt(env.EVAL_CASE_CONCURRENCY, 1),
    dbPoolMax: validInt(env.EVAL_DB_POOL_MAX, 5),
    // `safety` has its own dedicated threshold logic; `tool_selection` is
    // excluded while we baseline real production scores before deciding what
    // "failing" means (see services/evals/src/evaluators/tool-selection.ts).
    // Remove `tool_selection` from this default once a per-suite threshold is set.
    excludeFromThreshold: env.EVAL_EXCLUDE_FROM_THRESHOLD
      ? env.EVAL_EXCLUDE_FROM_THRESHOLD.split(',').map(s => s.trim())
      : ['safety', 'tool_selection']
  }
}

const isTestEnv = !!process.env.VITEST || process.env.NODE_ENV === 'test'

export const config = createConfig(process.env, {
  validateRunnerSettings: !isTestEnv
})
