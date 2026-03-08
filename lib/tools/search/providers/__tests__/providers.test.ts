import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSearchProvider,
  DEFAULT_PROVIDER,
  TavilySearchProvider
} from '../index'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('createSearchProvider', () => {
  it('defaults to tavily', () => {
    const provider = createSearchProvider()
    expect(provider).toBeInstanceOf(TavilySearchProvider)
  })

  it('returns the correct DEFAULT_PROVIDER', () => {
    expect(DEFAULT_PROVIDER).toBe('tavily')
  })

  it('creates tavily provider', () => {
    const provider = createSearchProvider('tavily')
    expect(provider).toBeInstanceOf(TavilySearchProvider)
  })

  it('creates brave provider', () => {
    const provider = createSearchProvider('brave')
    expect(provider).toBeDefined()
  })

  it('creates searxng provider', () => {
    const provider = createSearchProvider('searxng')
    expect(provider).toBeDefined()
  })

  it('falls back to tavily for unknown provider', () => {
    const provider = createSearchProvider('unknown' as any)
    expect(provider).toBeInstanceOf(TavilySearchProvider)
  })
})

describe('TavilySearchProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      env: { ...originalEnv, TAVILY_API_KEY: 'test-tavily-key' }
    })
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('throws if TAVILY_API_KEY is not set', async () => {
    process.env.TAVILY_API_KEY = ''
    const provider = new TavilySearchProvider()
    await expect(provider.search('test', 10, 'basic', [], [])).rejects.toThrow(
      'TAVILY_API_KEY'
    )
  })

  it('pads short queries to 5 characters', async () => {
    const provider = new TavilySearchProvider()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          images: [],
          query: 'hi   ',
          number_of_results: 0
        })
    })

    await provider.search('hi', 10, 'basic', [], [])
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.query).toBe('hi   ')
  })

  it('returns search results on success', async () => {
    const provider = new TavilySearchProvider()
    const mockResults = {
      results: [{ title: 'Test', content: 'Content', url: 'https://test.com' }],
      images: [{ url: 'https://img.com/1.png', description: 'An image' }],
      query: 'test query',
      number_of_results: 1
    }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResults)
    })

    const result = await provider.search('test query', 10, 'basic', [], [])
    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Test')
  })

  it('throws on API error', async () => {
    const provider = new TavilySearchProvider()
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: () => Promise.resolve('Rate limited')
    })

    await expect(provider.search('test', 10, 'basic', [], [])).rejects.toThrow(
      'Tavily API error 429'
    )
  })

  it('enforces minimum 5 max_results', async () => {
    const provider = new TavilySearchProvider()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          images: [],
          query: 'x',
          number_of_results: 0
        })
    })

    await provider.search('query', 2, 'basic', [], [])
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.max_results).toBe(5)
  })

  it('passes include/exclude domains', async () => {
    const provider = new TavilySearchProvider()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          images: [],
          query: 'q',
          number_of_results: 0
        })
    })

    await provider.search(
      'query',
      10,
      'advanced',
      ['example.com'],
      ['spam.com']
    )
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.include_domains).toEqual(['example.com'])
    expect(body.exclude_domains).toEqual(['spam.com'])
    expect(body.search_depth).toBe('advanced')
  })

  it('filters images without descriptions', async () => {
    const provider = new TavilySearchProvider()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          images: [
            { url: 'https://img.com/1.png', description: 'Valid' },
            { url: 'https://img.com/2.png', description: '' },
            { url: 'https://img.com/3.png', description: undefined }
          ],
          query: 'q',
          number_of_results: 0
        })
    })

    const result = await provider.search('query', 10, 'basic', [], [])
    // Only the image with a non-empty description should survive
    expect(result.images).toHaveLength(1)
  })
})

describe('BraveSearchProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      env: { ...originalEnv, BRAVE_SEARCH_API_KEY: 'test-brave-key' }
    })
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('throws if API key is not set', async () => {
    delete process.env.BRAVE_SEARCH_API_KEY
    const { BraveSearchProvider } = await import('../brave')
    const provider = new BraveSearchProvider()
    await expect(provider.search('test', 10, 'basic', [], [])).rejects.toThrow(
      'Brave Search API key not configured'
    )
  })

  it('searches web content type', async () => {
    const { BraveSearchProvider } = await import('../brave')
    const provider = new BraveSearchProvider()

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          web: {
            results: [
              {
                title: 'Result 1',
                description: 'Desc 1',
                url: 'https://example.com'
              }
            ]
          }
        })
    })

    const result = await provider.search('test', 10, 'basic', [], [], {
      type: 'general',
      content_types: ['web']
    })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Result 1')
    expect(result.number_of_results).toBe(1)
  })

  it('searches multiple content types in parallel', async () => {
    const { BraveSearchProvider } = await import('../brave')
    const provider = new BraveSearchProvider()

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          web: { results: [{ title: 'Web', url: 'https://web.com' }] },
          results: [{ title: 'Video', url: 'https://video.com' }]
        })
    })

    const result = await provider.search('test', 10, 'basic', [], [], {
      type: 'general',
      content_types: ['web', 'video']
    })
    // Should have made 2 fetch calls (web + video)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('handles API errors gracefully for individual content types', async () => {
    const { BraveSearchProvider } = await import('../brave')
    const provider = new BraveSearchProvider()

    mockFetch.mockRejectedValue(new Error('Network error'))

    // Should not throw - errors are caught per content type
    const result = await provider.search('test', 10, 'basic', [], [], {
      type: 'general',
      content_types: ['web']
    })
    expect(result.results).toEqual([])
  })
})
