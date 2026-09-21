import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockStreamText = vi.fn()
const mockGetRelatedQuestionsModel = vi.fn()
const mockGetModel = vi.fn()

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  Output: { array: (config: unknown) => config }
}))

vi.mock('@/lib/config/model-types', () => ({
  getRelatedQuestionsModel: () => mockGetRelatedQuestionsModel()
}))

vi.mock('@/lib/utils/registry', () => ({
  getModel: (...args: unknown[]) => mockGetModel(...args)
}))

import { createRelatedQuestionsStream } from '@/lib/agents/generate-related-questions'

describe('createRelatedQuestionsStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetModel.mockReturnValue('mock-model')
    mockStreamText.mockReturnValue('mock-stream')
  })

  it('forwards providerOptions from the model config to streamText', () => {
    mockGetRelatedQuestionsModel.mockReturnValue({
      providerId: 'openrouter',
      id: 'z-ai/glm-5.3-flash',
      providerOptions: {
        openrouter: { reasoning: { effort: 'low', exclude: true } }
      }
    })

    createRelatedQuestionsStream([])

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          openrouter: { reasoning: { effort: 'low', exclude: true } }
        }
      })
    )
  })

  it('omits providerOptions from streamText when the model has none', () => {
    mockGetRelatedQuestionsModel.mockReturnValue({
      providerId: 'gateway',
      id: 'google/gemini-3-flash'
    })

    createRelatedQuestionsStream([])

    expect(mockStreamText.mock.calls[0][0]).not.toHaveProperty(
      'providerOptions'
    )
  })
})
