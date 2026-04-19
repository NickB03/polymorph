import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'

const mockGenerateObject = vi.fn()
const mockGetTrendingSuggestionsModel = vi.fn()
const mockGetModel = vi.fn()
const mockTavilySearch = vi.fn()
const mockTavilyConstructor = vi.fn()
const mockBraveConstructor = vi.fn()
const mockExaConstructor = vi.fn()

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
  TavilySearchProvider: vi.fn().mockImplementation(function (this: unknown) {
    mockTavilyConstructor()
    ;(this as { search: typeof mockTavilySearch }).search = mockTavilySearch
  })
}))

vi.mock('@/lib/tools/search/providers/brave', () => ({
  BraveSearchProvider: vi.fn().mockImplementation(() => mockBraveConstructor())
}))

vi.mock('@/lib/tools/search/providers/exa', () => ({
  ExaSearchProvider: vi.fn().mockImplementation(() => mockExaConstructor())
}))

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'

describe('generateTrendingSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTrendingSuggestionsModel.mockReturnValue({
      providerId: 'gateway',
      id: 'google/gemini-3-flash'
    })
    mockGetModel.mockReturnValue('mock-model')
  })

  it('issues exactly one Tavily call (no cascade)', async () => {
    mockTavilySearch.mockResolvedValue({
      results: [
        { title: 'T', content: 'Context', url: 'https://a.com' },
        { title: 'U', content: 'Context 2', url: 'https://b.com' }
      ],
      query: 'q',
      images: []
    })
    mockGenerateObject.mockResolvedValue({ object: DEFAULT_SUGGESTIONS })

    await generateTrendingSuggestions()

    expect(mockTavilySearch).toHaveBeenCalledTimes(1)
    expect(mockBraveConstructor).not.toHaveBeenCalled()
    expect(mockExaConstructor).not.toHaveBeenCalled()
  })

  it('requests Tavily with images disabled and maxResults 5', async () => {
    mockTavilySearch.mockResolvedValue({
      results: [{ title: 'T', content: 'C', url: 'https://a.com' }],
      query: 'q',
      images: []
    })
    mockGenerateObject.mockResolvedValue({ object: DEFAULT_SUGGESTIONS })

    await generateTrendingSuggestions()

    const [query, maxResults, depth, , , options] =
      mockTavilySearch.mock.calls[0]
    expect(query).toContain('trending')
    expect(maxResults).toBe(5)
    expect(depth).toBe('basic')
    expect(options).toEqual({ includeImages: false })
  })

  it('returns the LLM-generated suggestions', async () => {
    const generated = {
      ...DEFAULT_SUGGESTIONS,
      research: ['a', 'b', 'c', 'd']
    }
    mockTavilySearch.mockResolvedValue({
      results: [{ title: 'T', content: 'C', url: 'https://a.com' }],
      query: 'q',
      images: []
    })
    mockGenerateObject.mockResolvedValue({ object: generated })

    const result = await generateTrendingSuggestions()

    expect(result.suggestions).toEqual(generated)
  })

  it('throws when Tavily returns no usable context', async () => {
    mockTavilySearch.mockResolvedValue({ results: [], query: 'q', images: [] })

    await expect(generateTrendingSuggestions()).rejects.toThrow(
      /no usable results/i
    )
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })

  it('propagates Tavily errors (so the cron handler can log a real failure)', async () => {
    mockTavilySearch.mockRejectedValue(new Error('Tavily 402 payment required'))

    await expect(generateTrendingSuggestions()).rejects.toThrow(/402/)
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })
})
