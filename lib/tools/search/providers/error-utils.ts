export interface HttpErrorInfo {
  status: number | undefined
  statusText: string | undefined
  retryAfter: string | undefined
}

/**
 * Extract HTTP-shaped fields (status, statusText, retry-after header) from an
 * unknown error. Search providers throw errors with different shapes —
 * Exa uses `status`, Firecrawl uses `statusCode`, both may expose a
 * Headers-like `headers.get(name)`. This helper centralizes the `any` coercion.
 */
export function extractHttpErrorInfo(error: unknown): HttpErrorInfo {
  if (typeof error !== 'object' || error === null) {
    return { status: undefined, statusText: undefined, retryAfter: undefined }
  }
  const err = error as {
    status?: unknown
    statusCode?: unknown
    statusText?: unknown
    headers?: { get?: (name: string) => string | null | undefined }
  }

  const rawStatus = err.statusCode ?? err.status
  const status = typeof rawStatus === 'number' ? rawStatus : undefined
  const statusText =
    typeof err.statusText === 'string' ? err.statusText : undefined
  const retryAfterHeader = err.headers?.get?.('retry-after')
  const retryAfter =
    typeof retryAfterHeader === 'string' ? retryAfterHeader : undefined

  return { status, statusText, retryAfter }
}
