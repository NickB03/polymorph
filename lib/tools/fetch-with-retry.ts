export type FetchWithRetryOptions = RequestInit & {
  retries?: number
  retryDelayMs?: number
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { retries = 1, retryDelayMs = 500, ...init } = options

  let attempt = 0
  while (true) {
    try {
      const response = await fetch(url, init)
      if (!isRetryableStatus(response.status) || attempt >= retries) {
        return response
      }
    } catch (error) {
      if (attempt >= retries) throw error
    }
    await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    attempt++
  }
}
