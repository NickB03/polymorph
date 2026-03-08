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

import { GET } from '../route'

describe('GET /api/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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

    expect(json).toEqual(DEFAULT_SUGGESTIONS)
    expect(response.headers.get('x-suggestions-source')).toBe('cache')
    expect(response.headers.get('x-suggestions-serve-mode')).toBe(
      'primary-cache'
    )
    expect(mockGenerateTrendingSuggestions).not.toHaveBeenCalled()
  })

  it('caches dynamic provider output with long TTL and stale cache', async () => {
    mockRedisGet.mockResolvedValueOnce(null)
    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: DEFAULT_SUGGESTIONS,
      source: 'tavily'
    })

    const response = await GET()
    const json = await response.json()

    expect(json).toEqual(DEFAULT_SUGGESTIONS)
    expect(response.headers.get('x-suggestions-source')).toBe('tavily')
    expect(response.headers.get('x-suggestions-serve-mode')).toBe(
      'fresh-generated'
    )
    expect(response.headers.get('x-suggestions-cache-ttl')).toBe('14400')
    expect(mockRedisSet).toHaveBeenCalledWith(
      'trending:suggestions',
      DEFAULT_SUGGESTIONS,
      { ex: 14400 }
    )
    expect(mockRedisSet).toHaveBeenCalledWith(
      'trending:suggestions:stale',
      DEFAULT_SUGGESTIONS,
      { ex: 604800 }
    )
  })

  it('uses stale cache when generation falls back to defaults', async () => {
    const stale = {
      ...DEFAULT_SUGGESTIONS,
      latest: [
        'stale latest 1',
        'stale latest 2',
        'stale latest 3',
        'stale latest 4'
      ]
    }

    mockRedisGet.mockImplementation((key: string) => {
      if (key === 'trending:suggestions') return Promise.resolve(null)
      if (key === 'trending:suggestions:stale') return Promise.resolve(stale)
      return Promise.resolve(null)
    })

    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: DEFAULT_SUGGESTIONS,
      source: 'default'
    })

    const response = await GET()
    const json = await response.json()

    expect(json).toEqual(stale)
    expect(response.headers.get('x-suggestions-source')).toBe('default')
    expect(response.headers.get('x-suggestions-serve-mode')).toBe('stale-cache')
    expect(response.headers.get('x-suggestions-cache-ttl')).toBe('900')
    expect(mockRedisSet).toHaveBeenCalledWith('trending:suggestions', stale, {
      ex: 900
    })
    expect(mockRedisSet).not.toHaveBeenCalledWith(
      'trending:suggestions:stale',
      expect.anything(),
      expect.anything()
    )
  })
})
