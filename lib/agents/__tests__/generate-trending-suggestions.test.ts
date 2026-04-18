import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'

const mockGenerateObject = vi.fn()
const mockGetTrendingSuggestionsModel = vi.fn()
const mockGetModel = vi.fn()
const mockTavilySearch = vi.fn()
const mockBraveSearch = vi.fn()
const mockExaSearch = vi.fn()

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args)
}))

vi.mock('@/lib/config/model-types', () => ({
  getTrendingSuggestionsModel: () => mockGetTrendingSuggestionsModel()
}))

vi.mock('@/lib/utils/registry', () => ({
  getModel: (...args: unknown[]) => mockGetModel(...args)
}))

vi.mock('@/lib/tools/search/providers/tavily', () => ({
  TavilySearchProvider: vi.fn(() => ({
    search: (...args: unknown[]) => mockTavilySearch(...args)
  }))
}))

vi.mock('@/lib/tools/search/providers/brave', () => ({
  BraveSearchProvider: vi.fn(() => ({
    search: (...args: unknown[]) => mockBraveSearch(...args)
  }))
}))

vi.mock('@/lib/tools/search/providers/exa', () => ({
  ExaSearchProvider: vi.fn(() => ({
    search: (...args: unknown[]) => mockExaSearch(...args)
  }))
}))

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'

const originalSearchProviderEnv = {
  BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  EXA_API_KEY: process.env.EXA_API_KEY
}

describe('generateTrendingSuggestions', () => {
  beforeAll(() => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-brave-key'
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    process.env.EXA_API_KEY = 'test-exa-key'
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()

    process.env.BRAVE_SEARCH_API_KEY = 'test-brave-key'
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    process.env.EXA_API_KEY = 'test-exa-key'

    mockGetTrendingSuggestionsModel.mockReturnValue({
      providerId: 'gateway',
      id: 'google/gemini-3-flash'
    })
    mockGetModel.mockReturnValue('mock-model')
  })

  afterAll(() => {
    restoreEnv(
      'BRAVE_SEARCH_API_KEY',
      originalSearchProviderEnv.BRAVE_SEARCH_API_KEY
    )
    restoreEnv('TAVILY_API_KEY', originalSearchProviderEnv.TAVILY_API_KEY)
    restoreEnv('EXA_API_KEY', originalSearchProviderEnv.EXA_API_KEY)
  })

  it('uses Brave successfully when available', async () => {
    mockBraveSearch.mockResolvedValue({
      results: [
        {
          title: 'Title',
          description: 'Context',
          url: 'https://a.com'
        }
      ],
      query: 'q',
      images: []
    })
    mockGenerateObject.mockResolvedValue({
      object: DEFAULT_SUGGESTIONS
    })

    const result = await generateTrendingSuggestions()

    expect(result.source).toBe('brave')
    expect(result.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(result.meta.isFallback).toBe(false)
    expect(result.meta.failureReason).toBeNull()
    expect(mockBraveSearch).toHaveBeenCalled()
    expect(mockTavilySearch).not.toHaveBeenCalled()
  })

  it('falls back to Tavily when Brave fails', async () => {
    mockBraveSearch.mockRejectedValue(new Error('Brave API error'))
    mockTavilySearch.mockResolvedValue({
      results: [
        {
          title: 'Fallback title',
          content: 'Fallback context',
          url: 'https://b.com'
        }
      ],
      query: 'q',
      images: []
    })
    mockGenerateObject.mockResolvedValue({
      object: DEFAULT_SUGGESTIONS
    })

    const result = await generateTrendingSuggestions()

    expect(result.source).toBe('tavily')
    expect(mockTavilySearch).toHaveBeenCalled()
  })

  it('falls back to Exa when Brave and Tavily fail', async () => {
    mockBraveSearch.mockRejectedValue(new Error('Brave down'))
    mockTavilySearch.mockRejectedValue(new Error('Tavily down'))
    mockExaSearch.mockResolvedValue({
      results: [
        {
          title: 'Exa title',
          content: 'Exa context',
          url: 'https://c.com'
        }
      ],
      query: 'q',
      images: []
    })
    mockGenerateObject.mockResolvedValue({
      object: DEFAULT_SUGGESTIONS
    })

    const result = await generateTrendingSuggestions()

    expect(result.source).toBe('exa')
    expect(mockExaSearch).toHaveBeenCalled()
  })

  it('runs Tavily fallback searches concurrently', async () => {
    mockBraveSearch.mockRejectedValue(new Error('Brave down'))

    let activeCalls = 0
    let maxConcurrentCalls = 0

    mockTavilySearch.mockImplementation(async () => {
      activeCalls += 1
      maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls)
      await Promise.resolve()
      await Promise.resolve()
      activeCalls -= 1

      return {
        results: [
          {
            title: 'Fallback title',
            content: 'Fallback context',
            url: 'https://b.com'
          }
        ],
        query: 'q',
        images: []
      }
    })
    mockGenerateObject.mockResolvedValue({
      object: DEFAULT_SUGGESTIONS
    })

    const result = await generateTrendingSuggestions()

    expect(result.source).toBe('tavily')
    expect(mockTavilySearch).toHaveBeenCalledTimes(3)
    expect(maxConcurrentCalls).toBeGreaterThan(1)
  })

  it('runs Exa fallback searches concurrently', async () => {
    mockBraveSearch.mockRejectedValue(new Error('Brave down'))
    mockTavilySearch.mockRejectedValue(new Error('Tavily down'))

    let activeCalls = 0
    let maxConcurrentCalls = 0

    mockExaSearch.mockImplementation(async () => {
      activeCalls += 1
      maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls)
      await Promise.resolve()
      await Promise.resolve()
      activeCalls -= 1

      return {
        results: [
          {
            title: 'Exa title',
            content: 'Exa context',
            url: 'https://c.com'
          }
        ],
        query: 'q',
        images: []
      }
    })
    mockGenerateObject.mockResolvedValue({
      object: DEFAULT_SUGGESTIONS
    })

    const result = await generateTrendingSuggestions()

    expect(result.source).toBe('exa')
    expect(mockExaSearch).toHaveBeenCalledTimes(3)
    expect(maxConcurrentCalls).toBeGreaterThan(1)
  })

  it('paces Brave trending searches sequentially', async () => {
    vi.useFakeTimers()
    let activeCalls = 0
    let maxConcurrentCalls = 0

    mockBraveSearch.mockImplementation(async () => {
      activeCalls += 1
      maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls)
      await Promise.resolve()
      activeCalls -= 1

      return {
        results: [
          {
            title: 'Title',
            description: 'Context',
            url: 'https://a.com'
          }
        ],
        query: 'q',
        images: []
      }
    })
    mockGenerateObject.mockResolvedValue({
      object: DEFAULT_SUGGESTIONS
    })

    const resultPromise = generateTrendingSuggestions()
    await vi.advanceTimersByTimeAsync(2200)
    const result = await resultPromise

    expect(result.source).toBe('brave')
    expect(mockBraveSearch).toHaveBeenCalledTimes(3)
    expect(maxConcurrentCalls).toBe(1)
  })

  it('returns static defaults when all providers fail', async () => {
    mockExaSearch.mockRejectedValue(new Error('Exa down'))
    mockTavilySearch.mockRejectedValue(new Error('Tavily down'))
    mockBraveSearch.mockRejectedValue(new Error('Brave down'))

    const result = await generateTrendingSuggestions()

    expect(result.source).toBe('default')
    expect(result.suggestions).toEqual(DEFAULT_SUGGESTIONS)
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })

  it('returns an explicit fallback reason when no search providers are configured', async () => {
    const originalBraveKey = process.env.BRAVE_SEARCH_API_KEY
    const originalTavilyKey = process.env.TAVILY_API_KEY
    const originalExaKey = process.env.EXA_API_KEY

    delete process.env.BRAVE_SEARCH_API_KEY
    delete process.env.TAVILY_API_KEY
    delete process.env.EXA_API_KEY

    try {
      const result = await generateTrendingSuggestions()

      expect(result.source).toBe('default')
      expect(result.meta.generatedAt).toBeNull()
      expect(result.meta.isFallback).toBe(true)
      expect(result.meta.failureReason).toBe('no-search-provider-configured')
    } finally {
      restoreEnv('BRAVE_SEARCH_API_KEY', originalBraveKey)
      restoreEnv('TAVILY_API_KEY', originalTavilyKey)
      restoreEnv('EXA_API_KEY', originalExaKey)
    }
  })
})

function restoreEnv(
  key: 'BRAVE_SEARCH_API_KEY' | 'TAVILY_API_KEY' | 'EXA_API_KEY',
  value: string | undefined
) {
  if (typeof value === 'undefined') {
    delete process.env[key]
    return
  }

  process.env[key] = value
}
