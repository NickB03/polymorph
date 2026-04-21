export interface JudgeConfig {
  judgeModel: string
  judgeBaseUrl?: string
  judgeApiKey?: string
  judgeReasoningEnabled: boolean
  judgeReasoningMaxTokens: number
}

export function validInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? fallback : n
}

function validPositiveInt(raw: string | undefined, fallback: number): number {
  const n = validInt(raw, fallback)
  return n > 0 ? n : fallback
}

export function validBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback
  return raw === 'true'
}

export function validateJudgeCredentials(
  env: NodeJS.ProcessEnv = process.env
): void {
  const apiKey = env.JUDGE_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'JUDGE_API_KEY is required for LLM judge evaluators. Set it in Railway env vars.'
    )
  }

  const baseUrl = env.JUDGE_BASE_URL?.trim()
  if (baseUrl) {
    try {
      new URL(baseUrl)
    } catch {
      throw new Error(
        `JUDGE_BASE_URL is not a valid URL: "${baseUrl}". Expected format: https://openrouter.ai/api/v1`
      )
    }
  }
}

export function createJudgeConfig(
  env: NodeJS.ProcessEnv = process.env
): JudgeConfig {
  return {
    judgeModel: env.JUDGE_MODEL ?? 'google/gemini-3.1-flash-lite-preview',
    judgeBaseUrl: env.JUDGE_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
    judgeApiKey: env.JUDGE_API_KEY?.trim(),
    judgeReasoningEnabled: validBool(env.JUDGE_REASONING_ENABLED, true),
    judgeReasoningMaxTokens: validPositiveInt(
      env.JUDGE_REASONING_MAX_TOKENS,
      1024
    )
  }
}
