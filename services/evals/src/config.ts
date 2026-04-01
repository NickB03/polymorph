// Environment configuration for the evals service
//
// Phoenix client reads PHOENIX_HOST and PHOENIX_API_KEY from env automatically.
// We validate they're set here for clear error messages.

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const config = {
  // Supabase Postgres — read-only access to chat data
  databaseUrl: required('DATABASE_URL'),

  // Phoenix — validated here, read by @arizeai/phoenix-client automatically
  phoenixHost: required('PHOENIX_HOST'),

  // LLM judge model (for evaluators)
  judgeModel: process.env.JUDGE_MODEL ?? 'gpt-4o-mini',

  // Sampling config
  sampleSize: parseInt(process.env.SAMPLE_SIZE ?? '50', 10),
  lookbackHours: parseInt(process.env.LOOKBACK_HOURS ?? '6', 10),

  // SSL — disable for local Supabase CLI
  databaseSslDisabled: process.env.DATABASE_SSL_DISABLED === 'true'
}
