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

  describe('buildPublicMapTilerUrl', () => {
    it('uses only NEXT_PUBLIC_MAPTILER_API_KEY even when server key is set', async () => {
      process.env.MAPTILER_API_KEY = 'server-secret'
      process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'public-ok'
      const { buildPublicMapTilerUrl } = await importFresh()
      const url = buildPublicMapTilerUrl('/x')
      expect(url).toContain('key=public-ok')
      expect(url).not.toContain('server-secret')
    })

    it('throws MapTilerConfigError when NEXT_PUBLIC_MAPTILER_API_KEY is missing', async () => {
      delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY
      process.env.MAPTILER_API_KEY = 'server-only'
      const { buildPublicMapTilerUrl, MapTilerConfigError } =
        await importFresh()
      expect(() => buildPublicMapTilerUrl('/x')).toThrow(MapTilerConfigError)
    })
  })

  describe('scrubMapTilerKeys', () => {
    it('redacts key query params', async () => {
      const { scrubMapTilerKeys } = await importFresh()
      expect(
        scrubMapTilerKeys(
          'GET https://api.maptiler.com/x?a=1&key=abc123 -> 500'
        )
      ).toBe('GET https://api.maptiler.com/x?a=1&key=[redacted] -> 500')
    })

    it('redacts keys in MapTilerApiError body and message', async () => {
      process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
      const { MapTilerApiError } = await importFresh()
      const error = new MapTilerApiError(
        500,
        'upstream error fetching ?key=leaky123 from /geocoding'
      )
      expect(error.message).toContain('key=[redacted]')
      expect(error.message).not.toContain('leaky123')
      expect(error.body).not.toContain('leaky123')
    })
  })

  describe('retry behavior', () => {
    it('retries once on 503 then returns 200', async () => {
      process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve('unavailable')
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true })
        })
      const { fetchMapTilerJson } = await importFresh()
      const result = await fetchMapTilerJson('/x')
      expect(result).toEqual({ ok: true })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('does not retry on 4xx (other than 429)', async () => {
      process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('forbidden')
      })
      const { fetchMapTilerJson } = await importFresh()
      await expect(fetchMapTilerJson('/x')).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('retries on 429', async () => {
      process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('rate limited')
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true })
        })
      const { fetchMapTilerJson } = await importFresh()
      const result = await fetchMapTilerJson('/x')
      expect(result).toEqual({ ok: true })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
