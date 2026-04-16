import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchProviderError } from '../errors'
import { ExaSearchProvider } from '../exa'
import { FirecrawlSearchProvider } from '../firecrawl'
import {
  BraveSearchProvider,
  createSearchProvider,
  DEFAULT_PROVIDER,
  TavilySearchProvider
} from '../index'
import { SearXNGSearchProvider } from '../searxng'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('createSearchProvider', () => {
  it('defaults to brave', () => {
    const provider = createSearchProvider()
    expect(provider).toBeInstanceOf(BraveSearchProvider)
  })

  it('returns the correct DEFAULT_PROVIDER', () => {
    expect(DEFAULT_PROVIDER).toBe('brave')
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

  it('throws on non-retryable API error', async () => {
    const provider = new TavilySearchProvider()
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid key'),
      headers: new Headers()
    })

    await expect(provider.search('test', 10, 'basic', [], [])).rejects.toThrow(
      'tavily API error 401'
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

  it('searches multiple content types sequentially', async () => {
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

  it('throws on web API errors so higher-level search fallback can run', async () => {
    const { BraveSearchProvider } = await import('../brave')
    const provider = new BraveSearchProvider()

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Forbidden'),
      headers: new Headers()
    })

    await expect(
      provider.search('test', 10, 'basic', [], [], {
        type: 'general',
        content_types: ['web']
      })
    ).rejects.toThrow('brave API error 403')
  })

  it('keeps auxiliary content type failures isolated', async () => {
    const { BraveSearchProvider } = await import('../brave')
    const provider = new BraveSearchProvider()

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: {
              results: [{ title: 'Web', url: 'https://web.com' }]
            }
          })
      })
      .mockRejectedValueOnce(new Error('Video network error'))

    const result = await provider.search('test', 10, 'basic', [], [], {
      type: 'general',
      content_types: ['web', 'video']
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Web')
    expect(result.videos).toEqual([])
  })
})

// --- Phase 1: retry + typed error tests ---

describe('Tavily retry behavior', () => {
  let savedTavilyKey: string | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    savedTavilyKey = process.env.TAVILY_API_KEY
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    mockFetch.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.TAVILY_API_KEY = savedTavilyKey
    vi.restoreAllMocks()
  })

  it('retries on 429 and eventually succeeds', async () => {
    const provider = new TavilySearchProvider()

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('Rate limited'),
        headers: new Headers()
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { title: 'OK', content: 'content', url: 'https://ok.com' }
            ],
            images: [],
            query: 'test',
            number_of_results: 1
          })
      })

    const promise = provider.search('test query', 10, 'basic', [], [])
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('OK')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('exhausts retries on persistent 429 and throws SearchProviderError', async () => {
    // Use real timers with tiny delays — fake timers cause unhandled rejection
    // warnings with async retry loops
    vi.useRealTimers()

    const { createHttpSearchError } = await import('../errors')
    const { retryWithBackoff } = await import('@/lib/utils/retry')
    const { isRetryableSearchError, getRetryDelayFromSearchError } =
      await import('../errors')

    const fn = vi.fn().mockImplementation(async () => {
      throw createHttpSearchError(
        'tavily',
        429,
        'Too Many Requests',
        undefined,
        'Rate limited'
      )
    })

    try {
      await retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelayMs: 1,
        maxDelayMs: 1,
        shouldRetry: error => isRetryableSearchError(error),
        getRetryDelay: (error, _attempt, defaultDelay) =>
          getRetryDelayFromSearchError(error) ?? defaultDelay
      })
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(SearchProviderError)
      expect((error as SearchProviderError).retryable).toBe(true)
      expect((error as SearchProviderError).status).toBe(429)
    }

    // initial + 2 retries
    expect(fn).toHaveBeenCalledTimes(3)
  })
})

describe('Brave retry and sequential behavior', () => {
  let savedBraveKey: string | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    savedBraveKey = process.env.BRAVE_SEARCH_API_KEY
    process.env.BRAVE_SEARCH_API_KEY = 'test-brave-key'
    mockFetch.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.BRAVE_SEARCH_API_KEY = savedBraveKey
    vi.restoreAllMocks()
  })

  it('content types execute sequentially (web then video then image)', async () => {
    const provider = new BraveSearchProvider()

    const callOrder: string[] = []

    mockFetch.mockImplementation(async (url: string) => {
      const endpoint = url.includes('/web/')
        ? 'web'
        : url.includes('/videos/')
          ? 'videos'
          : 'images'
      callOrder.push(endpoint)
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            web: { results: [] },
            results: []
          })
      }
    })

    const promise = provider.search('test', 5, 'basic', [], [], {
      content_types: ['web', 'video', 'image']
    })
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(callOrder).toEqual(['web', 'videos', 'images'])
  })

  it('retries on 429 and succeeds', async () => {
    const provider = new BraveSearchProvider()

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('Rate limited'),
        headers: new Headers()
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: {
              results: [
                { title: 'Result', description: 'Desc', url: 'https://r.com' }
              ]
            }
          })
      })

    const promise = provider.search('test', 10, 'basic', [], [], {
      content_types: ['web']
    })
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result.results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('exhausts retries on persistent 429 and throws SearchProviderError', async () => {
    vi.useRealTimers()

    const { createHttpSearchError } = await import('../errors')
    const { retryWithBackoff } = await import('@/lib/utils/retry')
    const { isRetryableSearchError, getRetryDelayFromSearchError } =
      await import('../errors')

    const fn = vi.fn().mockImplementation(async () => {
      throw createHttpSearchError(
        'brave',
        429,
        'Too Many Requests',
        undefined,
        'Rate limited'
      )
    })

    try {
      await retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelayMs: 1,
        maxDelayMs: 1,
        shouldRetry: error => isRetryableSearchError(error),
        getRetryDelay: (error, _attempt, defaultDelay) =>
          getRetryDelayFromSearchError(error) ?? defaultDelay
      })
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(SearchProviderError)
      expect((error as SearchProviderError).status).toBe(429)
    }

    expect(fn).toHaveBeenCalledTimes(3)
  })
})

describe('Exa retry behavior', () => {
  let savedExaKey: string | undefined
  let mockSearchAndContents: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    savedExaKey = process.env.EXA_API_KEY
    process.env.EXA_API_KEY = 'test-exa-key'
    mockSearchAndContents = vi.fn()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.EXA_API_KEY = savedExaKey
    vi.restoreAllMocks()
  })

  it('retries on transient error and succeeds', async () => {
    // The Exa SDK uses cross-fetch internally (not global fetch),
    // so we mock the ExaSearchProvider's retry layer by directly importing
    // and wrapping the provider behavior.
    const transientError = Object.assign(new Error('Server Error'), {
      status: 500
    })

    mockSearchAndContents
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({
        results: [
          {
            title: 'Result',
            url: 'https://example.com',
            highlights: ['highlight']
          }
        ]
      })

    // Use retrySearchOperation directly to test Exa's retry pattern
    const { retrySearchOperation } = await import('@/lib/utils/retry')
    const { createHttpSearchError, SearchProviderError: SPError } =
      await import('../errors')

    const promise = retrySearchOperation(async () => {
      try {
        return await mockSearchAndContents()
      } catch (error) {
        if (error instanceof SPError) throw error
        const status = (error as any)?.status
        if (typeof status === 'number') {
          throw createHttpSearchError(
            'exa',
            status,
            String(error),
            undefined,
            error
          )
        }
        throw new SPError({
          provider: 'exa',
          message: error instanceof Error ? error.message : 'Exa search failed',
          retryable: true,
          cause: error
        })
      }
    })

    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Result')
    expect(mockSearchAndContents).toHaveBeenCalledTimes(2)
  })
})

describe('Firecrawl retry behavior', () => {
  let savedFirecrawlKey: string | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    savedFirecrawlKey = process.env.FIRECRAWL_API_KEY
    process.env.FIRECRAWL_API_KEY = 'test-firecrawl-key'
    mockFetch.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.FIRECRAWL_API_KEY = savedFirecrawlKey
    vi.restoreAllMocks()
  })

  it('retries on transient error and succeeds', async () => {
    // Firecrawl client uses fetch internally - first call fails, second succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              web: [
                {
                  title: 'Result',
                  url: 'https://example.com',
                  description: 'A result',
                  markdown: 'content'
                }
              ],
              news: [],
              images: []
            }
          })
      })

    const provider = new FirecrawlSearchProvider()

    const promise = provider.search('test query', 5, 'basic', [], [])
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Result')
  })
})

describe('SearXNG retry behavior', () => {
  let savedSearxngUrl: string | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    savedSearxngUrl = process.env.SEARXNG_API_URL
    process.env.SEARXNG_API_URL = 'http://localhost:8080'
    mockFetch.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.SEARXNG_API_URL = savedSearxngUrl
    vi.restoreAllMocks()
  })

  it('retries on 500 and succeeds', async () => {
    const provider = new SearXNGSearchProvider()

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
        headers: new Headers()
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                title: 'Result',
                url: 'https://example.com',
                content: 'Some content'
              }
            ],
            query: 'test',
            number_of_results: 1
          })
      })

    const promise = provider.search('test', 5, 'basic', [], [])
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Result')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
