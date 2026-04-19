import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'

const mockGenerateObject = vi.fn()
const mockGetTrendingSuggestionsModel = vi.fn()
const mockGetModel = vi.fn()
const mockBraveSearch = vi.fn()
const mockTavilySearch = vi.fn()
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

vi.mock('@/lib/tools/search/providers/brave', () => ({
  BraveSearchProvider: vi.fn().mockImplementation(function (this: unknown) {
    ;(this as { search: typeof mockBraveSearch }).search = mockBraveSearch
  })
}))

vi.mock('@/lib/tools/search/providers/tavily', () => ({
  TavilySearchProvider: vi.fn().mockImplementation(function (this: unknown) {
    ;(this as { search: typeof mockTavilySearch }).search = mockTavilySearch
  })
}))

vi.mock('@/lib/tools/search/providers/exa', () => ({
  ExaSearchProvider: vi.fn().mockImplementation(function (this: unknown) {
    ;(this as { search: typeof mockExaSearch }).search = mockExaSearch
  })
}))

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'

const usableResults = {
  results: [
    { title: 'T', content: 'Context', url: 'https://a.com' },
    { title: 'U', content: 'Context 2', url: 'https://b.com' }
  ],
  query: 'q',
  images: []
}

const braveResults = {
  results: [
    { title: 'Brave T', description: 'Brave Context', url: 'https://a.com' },
    {
      title: 'Brave U',
      description: 'Brave Context 2',
      url: 'https://b.com'
    }
  ],
  query: 'q',
  images: []
}

describe('generateTrendingSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTrendingSuggestionsModel.mockReturnValue({
      providerId: 'gateway',
      id: 'google/gemini-3-flash'
    })
    mockGetModel.mockReturnValue('mock-model')
    mockGenerateObject.mockResolvedValue({ object: DEFAULT_SUGGESTIONS })
  })

  it('uses Brave first and does not call Tavily or Exa when Brave succeeds', async () => {
    mockBraveSearch.mockResolvedValue(braveResults)

    const result = await generateTrendingSuggestions()

    expect(mockBraveSearch).toHaveBeenCalledTimes(3)
    expect(mockTavilySearch).not.toHaveBeenCalled()
    expect(mockExaSearch).not.toHaveBeenCalled()
    expect(result.source).toBe('brave')
  })

  it('falls back to Tavily when Brave throws', async () => {
    mockBraveSearch.mockRejectedValue(new Error('Brave 429 rate limited'))
    mockTavilySearch.mockResolvedValue(usableResults)

    const result = await generateTrendingSuggestions()

    expect(mockBraveSearch).toHaveBeenCalledTimes(1)
    expect(mockTavilySearch).toHaveBeenCalledTimes(3)
    expect(mockExaSearch).not.toHaveBeenCalled()
    expect(result.source).toBe('tavily')
  })

  it('falls back to Tavily when Brave returns empty results', async () => {
    mockBraveSearch.mockResolvedValue({ results: [], query: 'q', images: [] })
    mockTavilySearch.mockResolvedValue(usableResults)

    const result = await generateTrendingSuggestions()

    expect(mockBraveSearch).toHaveBeenCalledTimes(3)
    expect(mockTavilySearch).toHaveBeenCalledTimes(3)
    expect(result.source).toBe('tavily')
  })

  it('falls through to Exa when Brave and Tavily both fail', async () => {
    mockBraveSearch.mockRejectedValue(new Error('Brave down'))
    mockTavilySearch.mockRejectedValue(new Error('Tavily 402'))
    mockExaSearch.mockResolvedValue(usableResults)

    const result = await generateTrendingSuggestions()

    expect(mockBraveSearch).toHaveBeenCalledTimes(1)
    expect(mockTavilySearch).toHaveBeenCalledTimes(3)
    expect(mockExaSearch).toHaveBeenCalledTimes(3)
    expect(result.source).toBe('exa')
  })

  it('requests Tavily with images disabled and maxResults 5', async () => {
    mockBraveSearch.mockRejectedValue(new Error('force fallback'))
    mockTavilySearch.mockResolvedValue(usableResults)

    await generateTrendingSuggestions()

    const [query, maxResults, depth, , , options] =
      mockTavilySearch.mock.calls[0]
    expect(query).toContain('trending')
    expect(maxResults).toBe(5)
    expect(depth).toBe('basic')
    expect(options).toEqual({ includeImages: false })
  })

  it('uses Brave descriptions when building the LLM context', async () => {
    mockBraveSearch.mockResolvedValue(braveResults)

    await generateTrendingSuggestions()

    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Brave Context')
      })
    )
  })

  it('returns the LLM-generated suggestions', async () => {
    const generated = {
      ...DEFAULT_SUGGESTIONS,
      research: ['a', 'b', 'c', 'd']
    }
    mockBraveSearch.mockResolvedValue(braveResults)
    mockGenerateObject.mockResolvedValue({ object: generated })

    const result = await generateTrendingSuggestions()

    expect(result.suggestions).toEqual(generated)
  })

  it('paces Brave searches sequentially across the query groups', async () => {
    let activeCalls = 0
    let maxConcurrentCalls = 0

    mockBraveSearch.mockImplementation(async () => {
      activeCalls += 1
      maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls)
      await Promise.resolve()
      activeCalls -= 1

      return braveResults
    })

    await generateTrendingSuggestions()

    expect(mockBraveSearch).toHaveBeenCalledTimes(3)
    expect(maxConcurrentCalls).toBe(1)
  })

  it('throws when every provider fails (so the cron handler logs the outage)', async () => {
    mockBraveSearch.mockRejectedValue(new Error('Brave down'))
    mockTavilySearch.mockRejectedValue(new Error('Tavily 402'))
    mockExaSearch.mockRejectedValue(new Error('Exa timeout'))

    await expect(generateTrendingSuggestions()).rejects.toThrow(
      /All trending providers failed/i
    )
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })

  it('throws when every provider returns empty results', async () => {
    const empty = { results: [], query: 'q', images: [] }
    mockBraveSearch.mockResolvedValue(empty)
    mockTavilySearch.mockResolvedValue(empty)
    mockExaSearch.mockResolvedValue(empty)

    await expect(generateTrendingSuggestions()).rejects.toThrow(
      /All trending providers failed/i
    )
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })
})
