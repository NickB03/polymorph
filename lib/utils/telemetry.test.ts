import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushTraces, isTracingEnabled } from './telemetry'

describe('isTracingEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when ENABLE_TRACING is not set', () => {
    vi.stubEnv('ENABLE_TRACING', '')
    expect(isTracingEnabled()).toBe(false)
  })

  it('returns false when ENABLE_TRACING is "false"', () => {
    vi.stubEnv('ENABLE_TRACING', 'false')
    expect(isTracingEnabled()).toBe(false)
  })

  it('returns true when ENABLE_TRACING is "true"', () => {
    vi.stubEnv('ENABLE_TRACING', 'true')
    expect(isTracingEnabled()).toBe(true)
  })
})

describe('flushTraces', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves without error when tracing is disabled', async () => {
    vi.stubEnv('ENABLE_TRACING', 'false')
    await expect(flushTraces()).resolves.toBeUndefined()
  })

  it('resolves without error when tracing is enabled but no provider registered', async () => {
    vi.stubEnv('ENABLE_TRACING', 'true')
    await expect(flushTraces()).resolves.toBeUndefined()
  })
})
