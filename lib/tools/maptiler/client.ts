const MAPTILER_BASE_URL = 'https://api.maptiler.com'

export class MapTilerConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MapTilerConfigError'
  }
}

export class MapTilerApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`MapTiler API error ${status}: ${body.slice(0, 200)}`)
    this.name = 'MapTilerApiError'
    this.status = status
    this.body = body
  }
}

function getApiKey(): string {
  const key =
    process.env.MAPTILER_API_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_API_KEY
  if (!key) {
    throw new MapTilerConfigError(
      'Neither MAPTILER_API_KEY nor NEXT_PUBLIC_MAPTILER_API_KEY is set. See docs/getting-started/ENVIRONMENT.md.'
    )
  }
  return key
}

export function buildMapTilerUrl(path: string): string {
  const key = getApiKey()
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = `${MAPTILER_BASE_URL}${normalized}`
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}key=${key}`
}

export async function fetchMapTilerJson<T>(path: string): Promise<T> {
  const url = buildMapTilerUrl(path)
  const response = await fetch(url)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new MapTilerApiError(response.status, body)
  }

  return (await response.json()) as T
}
