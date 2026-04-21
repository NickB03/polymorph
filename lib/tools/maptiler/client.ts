import { fetchWithRetry } from '../fetch-with-retry'

const MAPTILER_BASE_URL = 'https://api.maptiler.com'
const API_KEY_PATTERN = /([?&])key=[^&\s"']+/gi

export function scrubMapTilerKeys(input: string): string {
  return input.replace(API_KEY_PATTERN, '$1key=[redacted]')
}

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
    const scrubbed = scrubMapTilerKeys(body)
    super(`MapTiler API error ${status}: ${scrubbed.slice(0, 200)}`)
    this.name = 'MapTilerApiError'
    this.status = status
    this.body = scrubbed
  }
}

function getServerOrPublicApiKey(): string {
  const key =
    process.env.MAPTILER_API_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_API_KEY
  if (!key) {
    throw new MapTilerConfigError(
      'Neither MAPTILER_API_KEY nor NEXT_PUBLIC_MAPTILER_API_KEY is set. See docs/getting-started/ENVIRONMENT.md.'
    )
  }
  return key
}

function getPublicApiKey(): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY
  if (!key) {
    throw new MapTilerConfigError(
      'NEXT_PUBLIC_MAPTILER_API_KEY is required for client-visible MapTiler URLs (e.g. static map images). See docs/getting-started/ENVIRONMENT.md.'
    )
  }
  return key
}

function appendKey(path: string, key: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = `${MAPTILER_BASE_URL}${normalized}`
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}key=${key}`
}

export function buildMapTilerUrl(path: string): string {
  return appendKey(path, getServerOrPublicApiKey())
}

// Returns a URL embedded with the origin-restricted public key only. Use this
// for URLs that will be exposed to the browser (e.g. static map image results
// surfaced in chat). Never use buildMapTilerUrl for client-visible output: it
// prefers MAPTILER_API_KEY (server-only, unrestricted) when set.
export function buildPublicMapTilerUrl(path: string): string {
  return appendKey(path, getPublicApiKey())
}

export async function fetchMapTilerJson<T>(path: string): Promise<T> {
  const url = buildMapTilerUrl(path)
  const response = await fetchWithRetry(url)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new MapTilerApiError(response.status, body)
  }

  return (await response.json()) as T
}
