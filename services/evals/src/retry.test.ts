import { describe, expect, it, vi } from 'vitest'

import { withRetry } from './retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws if maxAttempts is 0', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(
      withRetry(fn, { maxAttempts: 0, baseDelayMs: 10 })
    ).rejects.toThrow('maxAttempts >= 1')
    expect(fn).not.toHaveBeenCalled()
  })

  it('bails immediately when shouldRetry returns false', async () => {
    class NonRetryable extends Error {
      retryable = false
    }
    const fn = vi.fn().mockRejectedValue(new NonRetryable('auth error'))
    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        shouldRetry: err => err instanceof NonRetryable && err.retryable
      })
    ).rejects.toThrow('auth error')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries when shouldRetry returns true', async () => {
    class Retryable extends Error {
      retryable = true
    }
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Retryable('server error'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      shouldRetry: err => err instanceof Retryable && err.retryable
    })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
