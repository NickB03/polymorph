import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/agents/chat/toolset', () => ({
  createChatAgentValidationTools: vi.fn(() => ({}))
}))

import { validateChatUIMessages } from '@/lib/agents/chat/message-contract'

describe('validateChatUIMessages', () => {
  it('accepts messages when metadata is omitted', async () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }]
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi there' }]
      }
    ]

    await expect(
      validateChatUIMessages({
        messages,
        tools: {} as any
      })
    ).resolves.toEqual(messages)
  })

  it('rejects malformed metadata when it is present', async () => {
    try {
      await validateChatUIMessages({
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            metadata: {
              feedbackScore: 'bad-score'
            },
            parts: [{ type: 'text', text: 'Hi there' }]
          }
        ],
        tools: {} as any
      })
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).name).toBe('AI_TypeValidationError')
      expect((error as Error).message).toContain('messages[0].metadata')
      expect((error as Error).message).toContain('feedbackScore')
      return
    }

    throw new Error('Expected malformed metadata to fail validation')
  })
})
