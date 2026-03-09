import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'

const mockGenerateObject = vi.fn()
const mockGetRelatedQuestionsModel = vi.fn()
const mockGetModel = vi.fn()
const mockTavilySearch = vi.fn()
const mockBraveSearch = vi.fn()

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args)
}))

vi.mock('@/lib/config/model-types', () => ({
  getRelatedQuestionsModel: () => mockGetRelatedQuestionsModel()
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

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'

describe('generateTrendingSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetRelatedQuestionsModel.mockReturnValue({
      providerId: 'gateway',
      id: 'google/gemini-3-flash'
    })
    mockGetModel.mockReturnValue('mock-model')
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

  it('returns static defaults when all providers fail', async () => {
    mockTavilySearch.mockRejectedValue(new Error('Tavily down'))
    mockBraveSearch.mockRejectedValue(new Error('Brave down'))

    const result = await generateTrendingSuggestions()

    expect(result.source).toBe('default')
    expect(result.suggestions).toEqual(DEFAULT_SUGGESTIONS)
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })
})
