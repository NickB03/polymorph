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

  it('parses eval runner settings and defaults', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'capability')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('CORPUS_VERSION', 'v2')

    const { createConfig } = await import('./config')
    const config = createConfig()

    expect(config.evalRunMode).toBe('capability')
    expect(config.evalRunnerUrl).toBe('https://app.example.com')
    expect(config.evalRunnerSecret).toBe('secret')
    expect(config.corpusVersion).toBe('v2')
    expect(config.appUrl).toBe('https://app.example.com')
    expect(config.smokeEnabled).toBe(true)
    expect(config.smokeCaseCount).toBe(1)
    expect(config.smokeTimeoutMs).toBe(300000)
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

  it('requires app auth settings for smoke mode', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'smoke')

    const { createConfig } = await import('./config')

    expect(() => createConfig()).toThrow('APP_URL')
  })
})
