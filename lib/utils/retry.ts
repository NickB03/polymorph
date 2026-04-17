// Exponential backoff retry utility

import {
  getRetryDelayFromSearchError,
  isRetryableSearchError
} from '@/lib/tools/search/providers/errors'

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
  shouldRetry?: (error: unknown, attempt: number) => boolean
  getRetryDelay?: (
    error: unknown,
    attempt: number,
    defaultDelay: number
  ) => number
  jitter?: boolean
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    onRetry,
    shouldRetry,
    getRetryDelay,
    jitter = false
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries) {
        throw error
      }

      if (shouldRetry && !shouldRetry(error, attempt + 1)) {
        throw error
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      )

      if (getRetryDelay) {
        delay = getRetryDelay(error, attempt + 1, delay)
      }

      if (jitter) {
        delay += Math.random() * 0.25 * delay
      }

      if (onRetry) {
        onRetry(error, attempt + 1, delay)
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Specialized retry for database operations
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return retryWithBackoff(operation, {
    maxRetries: 2,
    initialDelayMs: 200,
    maxDelayMs: 2000,
    onRetry: (error, attempt) => {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`Retrying ${operationName} (attempt ${attempt}):`, message)
    }
  })
}

// Specialized retry for search provider operations
export async function retrySearchOperation<T>(
  fn: () => Promise<T>,
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
): Promise<T> {
  return retryWithBackoff(fn, {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    jitter: true,
    shouldRetry: error => isRetryableSearchError(error),
    getRetryDelay: (error, _attempt, defaultDelay) =>
      getRetryDelayFromSearchError(error) ?? defaultDelay,
    onRetry
  })
}
