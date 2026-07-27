import { afterEach, describe, expect, it, vi } from 'vitest'

import { register } from './instrumentation'

afterEach(() => {
  vi.unstubAllEnvs()
  delete globalThis.__polymorphTracingState
})

describe('register', () => {
  it('sets tracing state to disabled-off when ENABLE_TRACING is not true', async () => {
    vi.stubEnv('ENABLE_TRACING', 'false')

    await register()

    expect(globalThis.__polymorphTracingState).toBe('disabled-off')
  })

  it('sets tracing state to disabled-https when the collector endpoint is plain HTTP in production', async () => {
    vi.stubEnv('ENABLE_TRACING', 'true')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')
    vi.stubEnv('PHOENIX_COLLECTOR_ENDPOINT', 'http://collector.example.com')
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    await register()

    expect(globalThis.__polymorphTracingState).toBe('disabled-https')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'PHOENIX_COLLECTOR_ENDPOINT must use HTTPS in production'
      )
    )
    consoleErrorSpy.mockRestore()
  })
})
