import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchProviderError } from '@/lib/tools/search/providers/errors'

import {
  retryDatabaseOperation,
  retrySearchOperation,
  retryWithBackoff
} from '../retry'

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

  it('calls onRetry callback with error, attempt number, and delayMs', async () => {
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
    // New 3-arg shape: (error, attempt, delayMs). Each invocation must
    // include a numeric delay > 0 alongside the error + attempt number.
    expect(onRetry).toHaveBeenNthCalledWith(1, error1, 1, expect.any(Number))
    expect(onRetry).toHaveBeenNthCalledWith(2, error2, 2, expect.any(Number))
    const firstDelay = onRetry.mock.calls[0][2]
    const secondDelay = onRetry.mock.calls[1][2]
    expect(firstDelay).toBeGreaterThan(0)
    expect(secondDelay).toBeGreaterThan(0)
  })

  it('remains backward compatible with 2-arg onRetry callbacks', async () => {
    // A caller that ignores the 3rd arg still typechecks and is invoked.
    let calls = 0
    const onRetry = (_error: unknown, attempt: number) => {
      expect(attempt).toBeGreaterThan(0)
      calls += 1
    }
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    await retryWithBackoff(fn, { initialDelayMs: 1, onRetry })
    expect(calls).toBe(1)
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

describe('retryWithBackoff shouldRetry/getRetryDelay/jitter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shouldRetry prevents retry on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'))

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      shouldRetry: () => false
    })

    await expect(promise).rejects.toThrow('non-retryable')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('shouldRetry allows retry on retryable errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok')

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      shouldRetry: () => true
    })

    await vi.advanceTimersByTimeAsync(200)
    const result = await promise

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('getRetryDelay overrides default delay', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    const customDelay = 42
    const promise = retryWithBackoff(fn, {
      maxRetries: 1,
      initialDelayMs: 1000,
      getRetryDelay: () => customDelay
    })

    // Advance less than 42ms — should not resolve yet
    await vi.advanceTimersByTimeAsync(41)
    expect(fn).toHaveBeenCalledTimes(1)

    // Advance past 42ms
    await vi.advanceTimersByTimeAsync(2)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('jitter adds randomness to delay', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    // Mock Math.random to return 1.0 (max jitter = 25% of delay)
    vi.spyOn(Math, 'random').mockReturnValue(1.0)

    const promise = retryWithBackoff(fn, {
      maxRetries: 1,
      initialDelayMs: 100,
      jitter: true
    })

    // base delay 100 + jitter 0.25*100*1.0 = 125ms
    await vi.advanceTimersByTimeAsync(124)
    expect(fn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)

    vi.restoreAllMocks()
  })
})

describe('retrySearchOperation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries SearchProviderError with retryable=true', async () => {
    const retryableError = new SearchProviderError({
      provider: 'tavily',
      message: 'rate limited',
      status: 429,
      retryable: true
    })

    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok')

    const promise = retrySearchOperation(fn)

    // Advance past initial delay (500ms + jitter)
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry SearchProviderError with retryable=false', async () => {
    const nonRetryableError = new SearchProviderError({
      provider: 'tavily',
      message: 'unauthorized',
      status: 401,
      retryable: false
    })

    const fn = vi.fn().mockRejectedValue(nonRetryableError)

    const promise = retrySearchOperation(fn)
    await expect(promise).rejects.toThrow('unauthorized')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('honors retryAfterMs from error', async () => {
    const errorWithRetryAfter = new SearchProviderError({
      provider: 'brave',
      message: 'rate limited',
      status: 429,
      retryable: true,
      retryAfterMs: 2000
    })

    const fn = vi
      .fn()
      .mockRejectedValueOnce(errorWithRetryAfter)
      .mockResolvedValue('ok')

    const promise = retrySearchOperation(fn)

    // The delay should be retryAfterMs (2000) + jitter
    // At 1999ms the retry should not have fired yet
    await vi.advanceTimersByTimeAsync(1999)
    expect(fn).toHaveBeenCalledTimes(1)

    // Advance past 2000 + max jitter (500)
    await vi.advanceTimersByTimeAsync(600)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('falls back to default delay when retryAfterMs is undefined', async () => {
    // Pin jitter to zero so the delay is deterministically the default
    // initialDelayMs (500). Without this stub the test sits on the 625ms
    // max-jitter boundary and can flake.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    const errorWithoutRetryAfter = new SearchProviderError({
      provider: 'brave',
      message: 'rate limited',
      status: 429,
      retryable: true,
      retryAfterMs: undefined
    })

    const fn = vi
      .fn()
      .mockRejectedValueOnce(errorWithoutRetryAfter)
      .mockResolvedValue('ok')

    const promise = retrySearchOperation(fn)

    // Default initial delay is 500ms with zero jitter.
    await vi.advanceTimersByTimeAsync(499)
    expect(fn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)

    randomSpy.mockRestore()
  })
})
