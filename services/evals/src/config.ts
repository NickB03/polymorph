import type { EvalRunMode } from './types'

// Environment configuration for the evals service.
// Phoenix client reads PHOENIX_HOST and PHOENIX_API_KEY from env automatically.

export interface EvalsConfig {
  databaseUrl: string
  phoenixHost: string
  phoenixApiKey: string
  judgeModel: string
  sampleSize: number
  lookbackHours: number
  databaseSslDisabled: boolean
  evalRunMode: EvalRunMode
  evalRunnerUrl?: string
  evalRunnerSecret?: string
  appUrl?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  seedUserEmail?: string
  seedUserPassword?: string
  corpusVersion: string
  smokeEnabled: boolean
  smokeCaseCount: number
  smokeTimeoutMs: number
}

export interface CreateConfigOptions {
  validateRunnerSettings?: boolean
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function validInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? fallback : n
}

function validBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback
  return raw === 'true'
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
  return mode === 'capability' || mode === 'regression' || mode === 'all'
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

  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    phoenixHost: required(env, 'PHOENIX_HOST'),
    phoenixApiKey: required(env, 'PHOENIX_API_KEY'),
    judgeModel: env.JUDGE_MODEL ?? 'gpt-4o-mini',
    sampleSize: validInt(env.SAMPLE_SIZE, 50),
    lookbackHours: validInt(env.LOOKBACK_HOURS, 6),
    databaseSslDisabled: env.DATABASE_SSL_DISABLED === 'true',
    evalRunMode,
    evalRunnerUrl,
    evalRunnerSecret,
    appUrl,
    supabaseUrl,
    supabaseAnonKey,
    seedUserEmail,
    seedUserPassword,
    corpusVersion: env.CORPUS_VERSION?.trim() || 'v1',
    smokeEnabled,
    smokeCaseCount: validInt(env.SMOKE_CASE_COUNT, 1),
    smokeTimeoutMs: validInt(env.SMOKE_TIMEOUT_MS, 300_000)
  }
}

export const config = createConfig(process.env, {
  validateRunnerSettings: false
})
