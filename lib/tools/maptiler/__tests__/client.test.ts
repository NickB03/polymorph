import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../client')
}

describe('maptiler client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('builds a URL with api key from NEXT_PUBLIC_MAPTILER_API_KEY', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
    const { buildMapTilerUrl } = await importFresh()
    expect(buildMapTilerUrl('/geocoding/Paris.json')).toBe(
      'https://api.maptiler.com/geocoding/Paris.json?key=test-key'
    )
  })

  it('prefers server-only MAPTILER_API_KEY when both are set', async () => {
    process.env.MAPTILER_API_KEY = 'server-key'
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'public-key'
    const { buildMapTilerUrl } = await importFresh()
    expect(buildMapTilerUrl('/x')).toBe(
      'https://api.maptiler.com/x?key=server-key'
    )
  })

  it('falls back to NEXT_PUBLIC_MAPTILER_API_KEY when server key is unset', async () => {
    delete process.env.MAPTILER_API_KEY
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'public-only'
    const { buildMapTilerUrl } = await importFresh()
    expect(buildMapTilerUrl('/x')).toBe(
      'https://api.maptiler.com/x?key=public-only'
    )
  })

  it('preserves existing query params when key is appended', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
    const { buildMapTilerUrl } = await importFresh()
    expect(
      buildMapTilerUrl('/directions/v1/driving/1,1;2,2?geometries=geojson')
    ).toBe(
      'https://api.maptiler.com/directions/v1/driving/1,1;2,2?geometries=geojson&key=k'
    )
  })

  it('throws MapTilerConfigError when both keys are missing', async () => {
    delete process.env.MAPTILER_API_KEY
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY
    const { buildMapTilerUrl, MapTilerConfigError } = await importFresh()
    expect(() => buildMapTilerUrl('/x')).toThrow(MapTilerConfigError)
  })

  it('fetchMapTilerJson returns parsed JSON on 200', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hello: 'world' })
    })
    const { fetchMapTilerJson } = await importFresh()
    const result = await fetchMapTilerJson('/x')
    expect(result).toEqual({ hello: 'world' })
  })

  it('fetchMapTilerJson throws MapTilerApiError on non-200', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('forbidden')
    })
    const { fetchMapTilerJson, MapTilerApiError } = await importFresh()
    await expect(fetchMapTilerJson('/x')).rejects.toThrow(MapTilerApiError)
  })
})
