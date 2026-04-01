interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
}

/**
 * Retry an async function with exponential backoff.
 * Delay doubles each attempt: baseDelayMs, baseDelayMs*2, baseDelayMs*4, ...
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  if (opts.maxAttempts < 1) {
    throw new Error('withRetry requires maxAttempts >= 1')
  }
  let lastError: unknown
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < opts.maxAttempts) {
        const delay = opts.baseDelayMs * 2 ** (attempt - 1)
        console.warn(
          `[retry] Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}
