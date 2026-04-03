import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const mockCapability = vi.fn()
const mockRegression = vi.fn()
const mockTrafficMonitor = vi.fn()
const mockSmoke = vi.fn()

vi.mock('./runners/capability', () => ({
  runCapabilitySuite: mockCapability
}))

vi.mock('./runners/regression', () => ({
  runRegressionSuite: mockRegression
}))

vi.mock('./runners/traffic-monitor', () => ({
  runTrafficMonitorSuite: mockTrafficMonitor
}))

vi.mock('./runners/smoke', () => ({
  runSmokeSuite: mockSmoke
}))

describe('main runner dispatch', () => {
  beforeEach(() => {
    mockCapability.mockReset()
    mockRegression.mockReset()
    mockTrafficMonitor.mockReset()
    mockSmoke.mockReset()
  })

  it('runs only capability mode when configured', async () => {
    mockCapability.mockResolvedValueOnce(undefined)

    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'capability')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('CORPUS_VERSION', 'v1')

    const { main } = await import('./index')
    await main()

    expect(mockCapability).toHaveBeenCalledTimes(1)
    expect(mockRegression).not.toHaveBeenCalled()
    expect(mockTrafficMonitor).not.toHaveBeenCalled()
    expect(mockSmoke).not.toHaveBeenCalled()
  })

  it('runs all modes in order when requested', async () => {
    mockCapability.mockResolvedValueOnce(undefined)
    mockRegression.mockResolvedValueOnce(undefined)
    mockTrafficMonitor.mockResolvedValueOnce(undefined)
    mockSmoke.mockResolvedValueOnce(undefined)

    vi.stubEnv('DATABASE_URL', 'postgresql://db')
    vi.stubEnv('PHOENIX_HOST', 'http://phoenix')
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')
    vi.stubEnv('EVAL_RUN_MODE', 'all')
    vi.stubEnv('EVAL_RUNNER_URL', 'https://app.example.com')
    vi.stubEnv('EVAL_RUNNER_SECRET', 'secret')
    vi.stubEnv('CORPUS_VERSION', 'v1')

    const { main } = await import('./index')
    await main()

    expect(mockCapability).toHaveBeenCalledTimes(1)
    expect(mockRegression).toHaveBeenCalledTimes(1)
    expect(mockTrafficMonitor).toHaveBeenCalledTimes(1)
    expect(mockSmoke).toHaveBeenCalledTimes(1)
  })
})
