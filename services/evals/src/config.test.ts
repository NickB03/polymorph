import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('createConfig', () => {
  it('defaults to capability mode', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.evalRunMode).toBe('capability')
  })

  it('defaults judgeModel to google/gemini-3.1-flash-lite-preview', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.judgeModel).toBe('google/gemini-3.1-flash-lite-preview')
  })

  it('defaults traffic-monitor settings for low-volume usage', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'traffic-monitor')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.sampleSize).toBe(10)
    expect(config.lookbackHours).toBe(48)
    expect(config.caseConcurrency).toBe(1)
  })

  it('parses eval runner settings and defaults', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'capability')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.evalRunMode).toBe('capability')
    expect(config.evalRunnerUrl).toBe('https://app.example.com')
    expect(config.evalRunnerSecret).toBe('secret')
    expect(config.appUrl).toBe('https://app.example.com')
    expect(config.evalRunnerTimeoutMs).toBe(300000)
    expect(config.smokeEnabled).toBe(true)
    expect(config.smokeCaseCount).toBe(1)
    expect(config.smokeTimeoutMs).toBe(300000)
    expect(config.judgeReasoningEnabled).toBe(true)
    expect(config.judgeReasoningMaxTokens).toBe(1024)
  })

  it('parses EVAL_RUNNER_TIMEOUT_MS from env', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('EVAL_RUNNER_TIMEOUT_MS', '600000')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.evalRunnerTimeoutMs).toBe(600000)
  })

  it('falls back when EVAL_RUNNER_TIMEOUT_MS is not positive', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('EVAL_RUNNER_TIMEOUT_MS', '0')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.evalRunnerTimeoutMs).toBe(300000)
  })

  it('defaults reasoning to enabled with a 1024 token budget', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.judgeReasoningEnabled).toBe(true)
    expect(config.judgeReasoningMaxTokens).toBe(1024)
  })

  it('parses JUDGE_REASONING_ENABLED from env', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('JUDGE_REASONING_ENABLED', 'true')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.judgeReasoningEnabled).toBe(true)
  })

  it('parses JUDGE_REASONING_MAX_TOKENS from env', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('JUDGE_REASONING_MAX_TOKENS', '2048')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.judgeReasoningMaxTokens).toBe(2048)
  })

  it('falls back to 1024 when JUDGE_REASONING_MAX_TOKENS is invalid', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('JUDGE_REASONING_MAX_TOKENS', '0')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.judgeReasoningMaxTokens).toBe(1024)
  })

  it('requires eval runner settings for capability mode', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'capability')

    const { createConfig } = await import('./config')

    expect(() => createConfig()).toThrow('EVAL_RUNNER_URL')
  })

  it('requires EVAL_RUNNER_SECRET for capability mode', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'capability')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')

    const { createConfig } = await import('./config')

    expect(() => createConfig()).toThrow('EVAL_RUNNER_SECRET')
  })

  it('requires eval runner settings for traffic-monitor mode', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'traffic-monitor')

    const { createConfig } = await import('./config')

    expect(() => createConfig()).toThrow('EVAL_RUNNER_URL')
  })

  it('requires EVAL_RUNNER_SECRET for traffic-monitor mode', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'traffic-monitor')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')

    const { createConfig } = await import('./config')

    expect(() => createConfig()).toThrow('EVAL_RUNNER_SECRET')
  })

  it('defaults scoreThreshold to 0.8', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.scoreThreshold).toBe(0.8)
  })

  it('parses SCORE_THRESHOLD from env', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('SCORE_THRESHOLD', '0.6')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.scoreThreshold).toBe(0.6)
  })

  it('defaults EVAL_EXIT_ON_THRESHOLD_BREACH to false', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.exitOnThresholdBreach).toBe(false)
  })

  it('parses EVAL_EXIT_ON_THRESHOLD_BREACH from env', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('EVAL_EXIT_ON_THRESHOLD_BREACH', 'true')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.exitOnThresholdBreach).toBe(true)
  })

  it('requires app auth settings for smoke mode', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'smoke')

    const { createConfig } = await import('./config')

    expect(() => createConfig()).toThrow('APP_URL')
  })
})
