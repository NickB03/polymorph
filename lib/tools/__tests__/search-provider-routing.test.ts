import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdvancedSearchResult } from '@/lib/tools/search/advanced-search.test-helpers'
import type { SearchResults } from '@/lib/types'

vi.mock('@/lib/schema/search', () => ({
  getSearchSchemaForModel: () => ({
    type: 'object',
    properties: {
      query: { type: 'string' }
    },
    required: ['query']
  })
}))

const providerSearchMocks = vi.hoisted(() => ({
  brave: vi.fn(),
  tavily: vi.fn(),
  exa: vi.fn(),
  searxng: vi.fn(),
  firecrawl: vi.fn()
}))

const advancedSearchMocks = vi.hoisted(() => ({
  runAdvancedSearch: vi.fn()
}))

vi.mock('../search/providers', () => ({
  DEFAULT_PROVIDER: 'brave',
  createSearchProvider: (provider: keyof typeof providerSearchMocks) => ({
    search: providerSearchMocks[provider]
  })
}))

vi.mock('@/lib/tools/search/advanced-search', () => ({
  runAdvancedSearch: advancedSearchMocks.runAdvancedSearch
}))

function createSearchResults(title: string): SearchResults {
  return {
    results: [
      {
        title,
        url: 'https://example.com',
        content: `${title} content`
      }
    ],
    images: [],
    query: 'sleep deprivation memory',
    number_of_results: 1
  }
}

async function collectSearchChunks() {
  const { createSearchTool } = await import('../search')
  const tool = createSearchTool('gateway:google/gemini-3-flash')
  const execute = tool.execute

  if (!execute) {
    throw new Error('No execute function')
  }

  const chunks: any[] = []
  const stream = execute(
    {
      query: 'sleep deprivation memory',
      type: 'optimized',
      content_types: ['web'],
      max_results: 20,
      search_depth: 'basic',
      include_domains: [],
      exclude_domains: []
    },
    { toolCallId: 'search-test', messages: [] }
  )

  if (stream && Symbol.asyncIterator in (stream as AsyncIterable<any>)) {
    for await (const chunk of stream as AsyncIterable<any>) {
      chunks.push(chunk)
    }
  }

  return chunks
}

async function collectAdvancedSearchChunks() {
  const { createSearchTool } = await import('../search')
  const tool = createSearchTool('gateway:google/gemini-3-flash')
  const execute = tool.execute

  if (!execute) {
    throw new Error('No execute function')
  }

  const chunks: any[] = []
  const stream = execute(
    {
      query: 'sleep deprivation memory',
      type: 'optimized',
      content_types: ['web'],
      max_results: 20,
      search_depth: 'advanced',
      include_domains: [],
      exclude_domains: []
    },
    { toolCallId: 'search-test', messages: [] }
  )

  if (stream && Symbol.asyncIterator in (stream as AsyncIterable<any>)) {
    for await (const chunk of stream as AsyncIterable<any>) {
      chunks.push(chunk)
    }
  }

  return chunks
}

describe('search provider routing', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.TAVILY_API_KEY
    delete process.env.BRAVE_SEARCH_API_KEY
    delete process.env.EXA_API_KEY
    delete process.env.SEARCH_API
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses Brave first when SEARCH_API=brave', async () => {
    process.env.SEARCH_API = 'brave'
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
    providerSearchMocks.brave.mockResolvedValueOnce(
      createSearchResults('Brave result')
    )

    const chunks = await collectSearchChunks()

    expect(providerSearchMocks.brave).toHaveBeenCalledOnce()
    expect(providerSearchMocks.tavily).not.toHaveBeenCalled()
    expect(providerSearchMocks.exa).not.toHaveBeenCalled()
    expect(chunks.at(-1)?.results?.[0]?.title).toBe('Brave result')
  })

  it('falls back from Brave to Tavily when Brave fails', async () => {
    process.env.SEARCH_API = 'brave'
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
    process.env.TAVILY_API_KEY = 'tavily-key'

    providerSearchMocks.brave.mockRejectedValueOnce(
      new Error('Brave web API error 500')
    )
    providerSearchMocks.tavily.mockResolvedValueOnce(
      createSearchResults('Tavily result')
    )

    const chunks = await collectSearchChunks()

    expect(providerSearchMocks.brave).toHaveBeenCalledOnce()
    expect(providerSearchMocks.tavily).toHaveBeenCalledOnce()
    expect(chunks.at(-1)?.results?.[0]?.title).toBe('Tavily result')
  })

  it('falls back from Brave to Tavily to Exa for web research', async () => {
    process.env.SEARCH_API = 'brave'
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
    process.env.TAVILY_API_KEY = 'tavily-key'
    process.env.EXA_API_KEY = 'exa-key'

    providerSearchMocks.brave.mockRejectedValueOnce(
      new Error('Brave web API error 500')
    )
    providerSearchMocks.tavily.mockRejectedValueOnce(
      new Error('Tavily API error 500')
    )
    providerSearchMocks.exa.mockResolvedValueOnce(
      createSearchResults('Fallback result')
    )

    const chunks = await collectSearchChunks()

    expect(providerSearchMocks.brave).toHaveBeenCalledOnce()
    expect(providerSearchMocks.tavily).toHaveBeenCalledOnce()
    expect(providerSearchMocks.exa).toHaveBeenCalledOnce()
    expect(chunks.at(-1)?.results?.[0]?.title).toBe('Fallback result')
  })

  it('keeps Tavily primary when it is explicitly configured', async () => {
    process.env.SEARCH_API = 'tavily'
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
    process.env.TAVILY_API_KEY = 'tavily-key'
    process.env.EXA_API_KEY = 'exa-key'

    providerSearchMocks.tavily.mockResolvedValueOnce(
      createSearchResults('Tavily primary result')
    )

    const chunks = await collectSearchChunks()

    expect(providerSearchMocks.tavily).toHaveBeenCalledOnce()
    expect(providerSearchMocks.brave).not.toHaveBeenCalled()
    expect(providerSearchMocks.exa).not.toHaveBeenCalled()
    expect(chunks.at(-1)?.results?.[0]?.title).toBe('Tavily primary result')
  })

  it('reaches the next provider cleanly when Brave is configured but unavailable', async () => {
    process.env.SEARCH_API = 'brave'
    process.env.TAVILY_API_KEY = 'tavily-key'

    providerSearchMocks.brave.mockRejectedValueOnce(
      new Error('Brave Search API key not configured')
    )
    providerSearchMocks.tavily.mockResolvedValueOnce(
      createSearchResults('Tavily fallback result')
    )

    const chunks = await collectSearchChunks()

    expect(providerSearchMocks.tavily).toHaveBeenCalledOnce()
    expect(chunks.at(-1)?.results?.[0]?.title).toBe('Tavily fallback result')
  })

  it('uses the shared advanced search runner for SearXNG advanced mode', async () => {
    process.env.SEARCH_API = 'searxng'
    process.env.SEARXNG_DEFAULT_DEPTH = 'advanced'
    process.env.SEARXNG_API_URL = 'https://searx.example.com'

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    advancedSearchMocks.runAdvancedSearch.mockResolvedValueOnce(
      createAdvancedSearchResult()
    )

    const chunks = await collectAdvancedSearchChunks()

    expect(advancedSearchMocks.runAdvancedSearch).toHaveBeenCalledOnce()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(chunks.at(-1)?.results?.[0]?.title).toBe('Advanced search result')
  })

  describe('transient-aware fallback delay', () => {
    beforeEach(() => {
      // Reset mock implementation queues — vi.clearAllMocks() in the
      // parent beforeEach only clears call history, not queued
      // mockRejectedValueOnce / mockResolvedValueOnce values.
      providerSearchMocks.brave.mockReset()
      providerSearchMocks.tavily.mockReset()
      providerSearchMocks.exa.mockReset()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('waits before fallback on transient provider error', async () => {
      vi.useFakeTimers()

      process.env.SEARCH_API = 'brave'
      process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
      process.env.TAVILY_API_KEY = 'tavily-key'

      // Import SearchProviderError from the same module instance that
      // search.ts will use (after vi.resetModules), so instanceof checks
      // inside isRetryableSearchError match correctly.
      const { SearchProviderError: SPE } =
        await import('../search/providers/errors')

      providerSearchMocks.brave.mockRejectedValueOnce(
        new SPE({
          provider: 'brave',
          message: 'Rate limited',
          status: 429,
          retryable: true
        })
      )
      providerSearchMocks.tavily.mockResolvedValueOnce(
        createSearchResults('Tavily result')
      )

      const { createSearchTool } = await import('../search')
      const tool = createSearchTool('gateway:google/gemini-3-flash')
      const execute = tool.execute!

      const stream = execute(
        {
          query: 'sleep deprivation memory',
          type: 'optimized',
          content_types: ['web'],
          max_results: 20,
          search_depth: 'basic',
          include_domains: [],
          exclude_domains: []
        },
        { toolCallId: 'search-test', messages: [] }
      )

      const iterator = (stream as AsyncIterable<any>)[Symbol.asyncIterator]()

      // First call: gets 'searching' state yield
      await iterator.next()

      // Second call: generator continues into the provider loop.
      // Brave rejects, catch block runs, and the 300ms setTimeout starts.
      // This promise won't resolve until the timer fires.
      const nextPromise = iterator.next()

      // Flush microtasks so the generator progresses to the setTimeout
      for (let i = 0; i < 50; i++) await Promise.resolve()

      expect(providerSearchMocks.brave).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1)
      expect(providerSearchMocks.tavily).not.toHaveBeenCalled()

      // Advance past the 300ms delay
      await vi.advanceTimersByTimeAsync(300)

      const result = await nextPromise
      expect(providerSearchMocks.tavily).toHaveBeenCalledOnce()

      // Drain remaining chunks
      const chunks: any[] = [result.value]
      for await (const chunk of {
        [Symbol.asyncIterator]: () => iterator
      }) {
        chunks.push(chunk)
      }

      expect(chunks.at(-1)?.results?.[0]?.title).toBe('Tavily result')
    })

    it('skips delay on permanent provider error', async () => {
      process.env.SEARCH_API = 'brave'
      process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
      process.env.TAVILY_API_KEY = 'tavily-key'

      const { SearchProviderError: SPE } =
        await import('../search/providers/errors')

      providerSearchMocks.brave.mockRejectedValueOnce(
        new SPE({
          provider: 'brave',
          message: 'Unauthorized',
          status: 401,
          retryable: false
        })
      )
      providerSearchMocks.tavily.mockResolvedValueOnce(
        createSearchResults('Tavily result')
      )

      const chunks = await collectSearchChunks()

      expect(providerSearchMocks.brave).toHaveBeenCalledOnce()
      expect(providerSearchMocks.tavily).toHaveBeenCalledOnce()
      expect(chunks.at(-1)?.results?.[0]?.title).toBe('Tavily result')
    })

    it('exits cleanly when aborted during fallback delay', async () => {
      vi.useFakeTimers()

      process.env.SEARCH_API = 'brave'
      process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
      process.env.TAVILY_API_KEY = 'tavily-key'

      const { SearchProviderError: SPE } =
        await import('../search/providers/errors')

      providerSearchMocks.brave.mockRejectedValueOnce(
        new SPE({
          provider: 'brave',
          message: 'Rate limited',
          status: 429,
          retryable: true
        })
      )
      providerSearchMocks.tavily.mockResolvedValueOnce(
        createSearchResults('Tavily result')
      )

      const { createSearchTool } = await import('../search')
      const tool = createSearchTool('gateway:google/gemini-3-flash')
      const execute = tool.execute!

      const abortController = new AbortController()

      const stream = execute(
        {
          query: 'sleep deprivation memory',
          type: 'optimized',
          content_types: ['web'],
          max_results: 20,
          search_depth: 'basic',
          include_domains: [],
          exclude_domains: []
        },
        {
          toolCallId: 'search-test',
          messages: [],
          abortSignal: abortController.signal
        }
      )

      const chunks: any[] = []
      const iterator = (stream as AsyncIterable<any>)[Symbol.asyncIterator]()

      // First chunk is 'searching' state
      const first = await iterator.next()
      if (!first.done) chunks.push(first.value)

      // Brave failed, delay is pending — abort now
      abortController.abort()
      await vi.advanceTimersByTimeAsync(300)

      // Drain remaining
      let next = await iterator.next()
      while (!next.done) {
        chunks.push(next.value)
        next = await iterator.next()
      }

      expect(providerSearchMocks.tavily).not.toHaveBeenCalled()
    })

    it('includes all provider names in error when all fail with retryable errors', async () => {
      vi.useFakeTimers()

      process.env.SEARCH_API = 'brave'
      process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
      process.env.TAVILY_API_KEY = 'tavily-key'
      process.env.EXA_API_KEY = 'exa-key'

      const { SearchProviderError: SPE } =
        await import('../search/providers/errors')

      providerSearchMocks.brave.mockRejectedValueOnce(
        new SPE({
          provider: 'brave',
          message: 'Service unavailable',
          status: 503,
          retryable: true
        })
      )
      providerSearchMocks.tavily.mockRejectedValueOnce(
        new SPE({
          provider: 'tavily',
          message: 'Rate limited',
          status: 429,
          retryable: true
        })
      )
      providerSearchMocks.exa.mockRejectedValueOnce(
        new SPE({
          provider: 'exa',
          message: 'Internal error',
          status: 500,
          retryable: true
        })
      )

      const { createSearchTool } = await import('../search')
      const tool = createSearchTool('gateway:google/gemini-3-flash')
      const execute = tool.execute!

      // Collect all chunks and capture any thrown error
      let thrownError: Error | null = null
      const collectPromise = (async () => {
        const stream = execute(
          {
            query: 'sleep deprivation memory',
            type: 'optimized',
            content_types: ['web'],
            max_results: 20,
            search_depth: 'basic',
            include_domains: [],
            exclude_domains: []
          },
          { toolCallId: 'search-test', messages: [] }
        )
        for await (const _chunk of stream as AsyncIterable<any>) {
          // consume
        }
      })().catch(error => {
        thrownError = error as Error
      })

      // Flush microtasks so brave is called and first 300ms delay starts
      await vi.advanceTimersByTimeAsync(0)

      // Advance past first delay (brave -> tavily)
      await vi.advanceTimersByTimeAsync(300)

      // Advance past second delay (tavily -> exa)
      await vi.advanceTimersByTimeAsync(300)

      await collectPromise

      expect(thrownError).not.toBeNull()
      expect(thrownError!.message).toContain('brave')
      expect(thrownError!.message).toContain('tavily')
      expect(thrownError!.message).toContain('exa')
    })
  })
})
