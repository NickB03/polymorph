export type SearchProviderName =
  | 'brave'
  | 'tavily'
  | 'exa'
  | 'firecrawl'
  | 'searxng'

export class SearchProviderError extends Error {
  readonly provider: SearchProviderName
  readonly status?: number
  readonly retryable: boolean
  readonly retryAfterMs?: number
  readonly cause?: unknown

  constructor(opts: {
    provider: SearchProviderName
    message: string
    status?: number
    retryable: boolean
    retryAfterMs?: number
    cause?: unknown
  }) {
    super(opts.message)
    this.name = 'SearchProviderError'
    this.provider = opts.provider
    this.status = opts.status
    this.retryable = opts.retryable
    this.retryAfterMs = opts.retryAfterMs
    this.cause = opts.cause
  }
}

export function isRetryableSearchError(error: unknown): boolean {
  return error instanceof SearchProviderError && error.retryable
}

export function getRetryDelayFromSearchError(
  error: unknown
): number | undefined {
  if (error instanceof SearchProviderError) {
    return error.retryAfterMs
  }
  return undefined
}

function parseRetryAfter(
  header: string | null | undefined
): number | undefined {
  if (!header) return undefined

  // Try parsing as seconds (integer)
  const seconds = Number(header)
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds * 1000
  }

  // Try parsing as HTTP date string
  const date = new Date(header)
  if (!Number.isNaN(date.getTime())) {
    const delta = date.getTime() - Date.now()
    return delta > 0 ? delta : undefined
  }

  return undefined
}

export function createHttpSearchError(
  provider: SearchProviderName,
  status: number,
  statusText: string,
  retryAfterHeader?: string | null,
  cause?: unknown
): SearchProviderError {
  const retryable = status === 429 || (status >= 500 && status <= 599)

  return new SearchProviderError({
    provider,
    message: `${provider} API error ${status}: ${statusText}`,
    status,
    retryable,
    retryAfterMs: retryable ? parseRetryAfter(retryAfterHeader) : undefined,
    cause
  })
}
