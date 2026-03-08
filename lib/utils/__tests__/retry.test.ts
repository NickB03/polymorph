import { describe, expect, it, vi } from 'vitest'

import { retryDatabaseOperation, retryWithBackoff } from '../retry'

describe('retryWithBackoff', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await retryWithBackoff(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and returns on eventual success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok')

    const result = await retryWithBackoff(fn, { initialDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws the last error after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 1 })
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('respects maxRetries=0 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(
      retryWithBackoff(fn, { maxRetries: 0, initialDelayMs: 1 })
    ).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls onRetry callback with error and attempt number', async () => {
    const onRetry = vi.fn()
    const error1 = new Error('e1')
    const error2 = new Error('e2')
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValue('ok')

    await retryWithBackoff(fn, { initialDelayMs: 1, onRetry })

    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(error1, 1)
    expect(onRetry).toHaveBeenCalledWith(error2, 2)
  })

  it('caps delay at maxDelayMs', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    const start = Date.now()
    await retryWithBackoff(fn, {
      initialDelayMs: 10000,
      maxDelayMs: 1,
      maxRetries: 1
    })
    const elapsed = Date.now() - start

    // Should be very fast since maxDelayMs is 1ms
    expect(elapsed).toBeLessThan(100)
  })

  it('uses exponential backoff with custom multiplier', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    // With initialDelayMs=10, multiplier=3:
    // attempt 0 delay = min(10 * 3^0, 5000) = 10ms
    // attempt 1 delay = min(10 * 3^1, 5000) = 30ms
    await retryWithBackoff(fn, {
      initialDelayMs: 10,
      backoffMultiplier: 3,
      maxRetries: 2
    })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('uses default options when none provided', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    // Default: maxRetries=3, initialDelayMs=100
    // Just verify it works with defaults (will be slow due to 100ms delay)
    const result = await retryWithBackoff(fn)
    expect(result).toBe('ok')
  })
})

describe('retryDatabaseOperation', () => {
  it('retries a failing database operation and logs', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValue('data')

    const result = await retryDatabaseOperation(fn, 'saveChat')
    expect(result).toBe('data')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Retrying saveChat (attempt 1):'),
      'connection lost'
    )

    consoleSpy.mockRestore()
  })

  it('throws after 2 retries (maxRetries=2)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fn = vi.fn().mockRejectedValue(new Error('db down'))

    await expect(retryDatabaseOperation(fn, 'loadChat')).rejects.toThrow(
      'db down'
    )
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries

    vi.restoreAllMocks()
  })
})
