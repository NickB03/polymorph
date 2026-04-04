import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGateway = vi.hoisted(() => vi.fn())

vi.mock('@ai-sdk/gateway', () => ({
  gateway: mockGateway
}))

vi.mock('../config', () => ({
  config: {
    judgeModel: 'openai/gpt-4o-mini'
  }
}))

vi.mock('../corpus', () => ({
  getCorpusVersion: vi.fn(() => 'v2')
}))

describe('buildDatasetExamples', () => {
  beforeEach(() => {
    mockGateway.mockReset()
  })

  it('maps prompt, query, and context from the latest user turn', async () => {
    const { buildDatasetExamples } = await import('./shared')

    const examples = buildDatasetExamples(
      [
        {
          id: 'case-1',
          suite: 'capability',
          conversation: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'first question' }]
            },
            {
              role: 'assistant',
              parts: [{ type: 'text', text: 'follow up?' }]
            },
            {
              role: 'user',
              parts: [{ type: 'text', text: 'last question' }]
            }
          ],
          searchMode: 'research',
          modelType: 'quality',
          tags: ['multi-turn'],
          requiresTextAnswer: true,
          requiresCitations: true,
          allowsInteractiveOnly: false
        }
      ],
      [
        {
          answerText: 'answer',
          citations: [{ title: 'Source', url: 'https://example.com' }],
          searchResults: [
            {
              query: 'last question',
              results: [
                {
                  title: 'Result 1',
                  url: 'https://example.com/r1',
                  snippet: 'Relevant snippet'
                }
              ]
            }
          ],
          toolNames: [],
          usedInteractiveOnlyOutput: false,
          modelId: 'model',
          durationMs: 1
        }
      ]
    )

    expect(examples).toHaveLength(1)
    expect(examples[0].input.prompt).toBe('last question')
    expect(examples[0].input.query).toBe('last question')
    expect(examples[0].input.prompt).toBe(examples[0].input.query)
    expect(examples[0].input.context).toContain('[Search: "last question"]')
    expect(examples[0].input.context).toContain('- Result 1: Relevant snippet')
    expect(examples[0].input.context).toContain('[Citations]')
    expect(examples[0].input.context).toContain(
      '- Source (https://example.com)'
    )
  })

  it('returns an empty context when there are no search results or citations', async () => {
    const { buildDatasetExamples } = await import('./shared')

    const examples = buildDatasetExamples(
      [
        {
          id: 'case-2',
          suite: 'regression',
          conversation: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'hello there' }]
            }
          ],
          searchMode: 'chat',
          modelType: 'speed',
          tags: [],
          requiresTextAnswer: true,
          requiresCitations: false,
          allowsInteractiveOnly: true
        }
      ],
      [
        {
          answerText: 'answer',
          citations: [],
          searchResults: [],
          toolNames: [],
          usedInteractiveOnlyOutput: false,
          modelId: 'model',
          durationMs: 1
        }
      ]
    )

    expect(examples[0].input.query).toBe('hello there')
    expect(examples[0].input.context).toBe('')
  })
})

describe('createJudgeModel', () => {
  beforeEach(() => {
    mockGateway.mockReset()
    mockGateway.mockReturnValue({ id: 'gateway-model' })
  })

  it('constructs the judge model through the gateway provider', async () => {
    const { createJudgeModel } = await import('./shared')

    const model = createJudgeModel()

    expect(mockGateway).toHaveBeenCalledTimes(1)
    expect(mockGateway).toHaveBeenCalledWith('openai/gpt-4o-mini')
    expect(model).toEqual({ id: 'gateway-model' })
  })
})
