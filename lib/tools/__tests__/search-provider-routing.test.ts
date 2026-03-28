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
})
