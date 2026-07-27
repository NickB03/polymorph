import { z } from 'zod'

const baseEnvSchema = z.object({
  // Database — at least one of DATABASE_URL or POSTGRES_URL must be set
  DATABASE_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  DATABASE_RESTRICTED_URL: z.string().optional(),

  // Auth (gracefully optional — app works without Supabase in limited mode)
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),

  // Optional with defaults
  DAILY_CHAT_LIMIT: z.coerce.number().default(100),
  GUEST_CHAT_DAILY_LIMIT: z.coerce.number().default(10),
  DATABASE_SSL_DISABLED: z.string().default('false'),

  // Tracing / observability (optional)
  ENABLE_TRACING: z.enum(['true', 'false']).optional().default('false'),
  EVAL_REPLAY_TRACING_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('false'),
  PHOENIX_COLLECTOR_ENDPOINT: z.string().optional(),
  PHOENIX_PROJECT_NAME: z.string().optional(),
  PHOENIX_API_KEY: z.string().optional(),
  OPENINFERENCE_HIDE_INPUTS: z.string().optional(),
  OPENINFERENCE_HIDE_OUTPUTS: z.string().optional(),

  // Feature-gated (warn if missing)
  OPENROUTER_API_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional()
})

export function isProductionTarget() {
  return (
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_TARGET_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV)
  )
}

const envSchema = baseEnvSchema
  .refine(data => data.DATABASE_URL || data.POSTGRES_URL, {
    message: 'At least one of DATABASE_URL or POSTGRES_URL must be set',
    path: ['DATABASE_URL']
  })
  .refine(data => !isProductionTarget() || Boolean(data.NEXT_PUBLIC_APP_URL), {
    message:
      'NEXT_PUBLIC_APP_URL must be set for production deployments so metadata URLs resolve correctly',
    path: ['NEXT_PUBLIC_APP_URL']
  })

type Env = z.infer<typeof envSchema>

let _env: Env | undefined

const featureWarnings: Array<{
  key: keyof z.input<typeof envSchema>
  message: string
}> = [
  {
    key: 'OPENROUTER_API_KEY',
    message: 'Default text model features require OPENROUTER_API_KEY'
  },
  {
    key: 'AI_GATEWAY_API_KEY',
    message: 'Image generation requires AI_GATEWAY_API_KEY'
  },
  { key: 'TAVILY_API_KEY', message: 'Search requires TAVILY_API_KEY' },
  {
    key: 'UPSTASH_REDIS_REST_URL',
    message: 'Rate limiting requires UPSTASH_REDIS_REST_URL'
  }
]

export function validateEnv(): Env {
  // Skip validation during build phase and tests
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
  const isTest = process.env.NODE_ENV === 'test'

  if (isBuild || isTest) {
    // Return a minimal parsed object without validation
    _env = envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL ?? 'skip-validation',
      POSTGRES_URL: process.env.POSTGRES_URL,
      DATABASE_RESTRICTED_URL: process.env.DATABASE_RESTRICTED_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      DAILY_CHAT_LIMIT: process.env.DAILY_CHAT_LIMIT,
      GUEST_CHAT_DAILY_LIMIT: process.env.GUEST_CHAT_DAILY_LIMIT,
      DATABASE_SSL_DISABLED: process.env.DATABASE_SSL_DISABLED,
      ENABLE_TRACING: process.env.ENABLE_TRACING,
      EVAL_REPLAY_TRACING_ENABLED: process.env.EVAL_REPLAY_TRACING_ENABLED,
      PHOENIX_COLLECTOR_ENDPOINT: process.env.PHOENIX_COLLECTOR_ENDPOINT,
      PHOENIX_PROJECT_NAME: process.env.PHOENIX_PROJECT_NAME,
      PHOENIX_API_KEY: process.env.PHOENIX_API_KEY,
      OPENINFERENCE_HIDE_INPUTS: process.env.OPENINFERENCE_HIDE_INPUTS,
      OPENINFERENCE_HIDE_OUTPUTS: process.env.OPENINFERENCE_HIDE_OUTPUTS,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
    })
    return _env
  }

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const missing = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(`Environment variable validation failed:\n${missing}`)
  }

  _env = result.data

  // Log warnings for missing feature-gated variables
  for (const { key, message } of featureWarnings) {
    if (!process.env[key]) {
      console.warn(`[env] Warning: ${message}`)
    }
  }

  return _env
}

export function getEnv(): Env {
  if (!_env) {
    return validateEnv()
  }
  return _env
}
