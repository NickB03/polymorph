import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'

const mockGenerateTrendingSuggestions = vi.fn()
const mockGetRedis = vi.fn()

const mockRedisGet = vi.fn()
const mockRedisSet = vi.fn()
const mockRedisDel = vi.fn()

vi.mock('@/lib/agents/generate-trending-suggestions', () => ({
  generateTrendingSuggestions: (...args: unknown[]) =>
    mockGenerateTrendingSuggestions(...args)
}))

vi.mock('@/lib/rate-limit/redis', () => ({
  getRedis: (...args: unknown[]) => mockGetRedis(...args)
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn()
}))

import { GET } from '../route'

describe('GET /api/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateTrendingSuggestions.mockReset()
    mockGetRedis.mockReset()
    mockRedisGet.mockReset()
    mockRedisSet.mockReset()
    mockRedisDel.mockReset()

    mockGetRedis.mockReturnValue({
      get: mockRedisGet,
      set: mockRedisSet,
      del: mockRedisDel
    })

    mockRedisSet.mockResolvedValue('OK')
    mockRedisDel.mockResolvedValue(1)
  })

  it('returns cached suggestions immediately when cache key is populated', async () => {
    mockRedisGet.mockResolvedValueOnce(DEFAULT_SUGGESTIONS)

    const response = await GET()
    const json = await response.json()

    expect(json).toEqual({
      suggestions: DEFAULT_SUGGESTIONS,
      meta: {
        source: 'cache',
        serveMode: 'primary-cache',
        servedFrom: 'primary-cache',
        generatedAt: null,
        isFallback: false,
        failureReason: null
      }
    })
    expect(response.headers.get('x-suggestions-source')).toBe('cache')
    expect(response.headers.get('x-suggestions-serve-mode')).toBe(
      'primary-cache'
    )
    expect(response.headers.get('cache-control')).toContain('s-maxage=1800')
    expect(mockGenerateTrendingSuggestions).not.toHaveBeenCalled()
  })

  it('caches dynamic provider output with long TTL and stale cache', async () => {
    mockRedisGet.mockResolvedValueOnce(null)
    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: DEFAULT_SUGGESTIONS,
      source: 'tavily',
      meta: {
        generatedAt: '2026-04-17T16:00:00.000Z',
        isFallback: false,
        failureReason: null
      }
    })

    const response = await GET()
    const json = await response.json()

    expect(json).toEqual({
      suggestions: DEFAULT_SUGGESTIONS,
      meta: {
        source: 'tavily',
        serveMode: 'fresh-generated',
        servedFrom: 'fresh-generated',
        generatedAt: '2026-04-17T16:00:00.000Z',
        isFallback: false,
        failureReason: null
      }
    })
    expect(response.headers.get('x-suggestions-source')).toBe('tavily')
    expect(response.headers.get('x-suggestions-serve-mode')).toBe(
      'fresh-generated'
    )
    expect(response.headers.get('x-suggestions-cache-ttl')).toBe('1800')
    expect(response.headers.get('cache-control')).toContain('s-maxage=1800')
    expect(response.headers.get('cache-control')).toContain(
      'stale-while-revalidate=300'
    )
    expect(mockRedisSet).toHaveBeenCalledWith(
      'trending:suggestions',
      {
        suggestions: DEFAULT_SUGGESTIONS,
        source: 'tavily',
        meta: {
          generatedAt: '2026-04-17T16:00:00.000Z',
          isFallback: false,
          failureReason: null
        }
      },
      { ex: 1800 }
    )
    expect(mockRedisSet).toHaveBeenCalledWith(
      'trending:suggestions:stale',
      {
        suggestions: DEFAULT_SUGGESTIONS,
        source: 'tavily',
        meta: {
          generatedAt: '2026-04-17T16:00:00.000Z',
          isFallback: false,
          failureReason: null
        }
      },
      { ex: 86400 }
    )
  })

  it('preserves stale dynamic cache when generation degrades', async () => {
    const stalePayload = {
      suggestions: {
        ...DEFAULT_SUGGESTIONS,
        latest: [
          'stale latest 1',
          'stale latest 2',
          'stale latest 3',
          'stale latest 4'
        ]
      },
      source: 'brave',
      meta: {
        generatedAt: '2026-04-17T15:00:00.000Z',
        isFallback: false,
        failureReason: null
      }
    }

    mockRedisGet.mockImplementation((key: string) => {
      if (key === 'trending:suggestions') return Promise.resolve(null)
      if (key === 'trending:suggestions:stale') {
        return Promise.resolve(stalePayload)
      }
      return Promise.resolve(null)
    })

    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: DEFAULT_SUGGESTIONS,
      source: 'default',
      meta: {
        generatedAt: null,
        isFallback: true,
        failureReason: 'search-provider-failed'
      }
    })

    const response = await GET()
    const json = await response.json()

    expect(json).toEqual({
      suggestions: stalePayload.suggestions,
      meta: {
        source: 'brave',
        serveMode: 'stale-cache',
        servedFrom: 'stale-cache',
        generatedAt: '2026-04-17T15:00:00.000Z',
        isFallback: false,
        failureReason: null
      }
    })
    expect(response.headers.get('x-suggestions-source')).toBe('brave')
    expect(response.headers.get('x-suggestions-serve-mode')).toBe('stale-cache')
    expect(response.headers.get('x-suggestions-cache-ttl')).toBe('1800')
    expect(response.headers.get('cache-control')).toContain('s-maxage=1800')
    expect(mockRedisSet).toHaveBeenCalledWith(
      'trending:suggestions',
      stalePayload,
      {
        ex: 1800
      }
    )
    expect(mockRedisSet).not.toHaveBeenCalledWith(
      'trending:suggestions:stale',
      expect.anything(),
      expect.anything()
    )
  })

  it('does not cache hardcoded default fallback responses', async () => {
    mockRedisGet.mockResolvedValueOnce(null)
    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: DEFAULT_SUGGESTIONS,
      source: 'default',
      meta: {
        generatedAt: null,
        isFallback: true,
        failureReason: 'no-search-provider-configured'
      }
    })

    const response = await GET()
    const json = await response.json()

    expect(json).toEqual({
      suggestions: DEFAULT_SUGGESTIONS,
      meta: {
        source: 'default',
        serveMode: 'fresh-generated',
        servedFrom: 'fresh-generated',
        generatedAt: null,
        isFallback: true,
        failureReason: 'no-search-provider-configured'
      }
    })
    expect(response.headers.get('x-suggestions-source')).toBe('default')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('cdn-cache-control')).toBe('no-store')
    expect(mockRedisSet).not.toHaveBeenCalledWith(
      'trending:suggestions',
      expect.anything(),
      expect.anything()
    )
  })
})
