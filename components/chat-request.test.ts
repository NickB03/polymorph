import { describe, expect, it } from 'vitest'

import { buildChatRequestBody } from './chat-request'

describe('chat request helpers', () => {
  it('builds a submit-message request for guest users', () => {
    const request = buildChatRequestBody({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'hello' }]
        }
      ] as any,
      trigger: 'submit-message',
      messageId: undefined,
      chatId: 'chat-1',
      isGuest: true,
      savedMessagesCount: 0
    })

    expect(request).toEqual({
      body: expect.objectContaining({
        trigger: 'submit-message',
        chatId: 'chat-1'
      })
    })
  })

  it('builds a submit-message continuation request with canonical messages', () => {
    const request = buildChatRequestBody({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-displayOptionList',
              toolCallId: 'tool-1',
              state: 'output-available',
              output: { value: 'dark' }
            }
          ]
        }
      ] as any,
      trigger: 'submit-message',
      messageId: undefined,
      chatId: 'chat-1',
      isGuest: true,
      savedMessagesCount: 2
    })

    expect(request).toEqual({
      body: {
        trigger: 'submit-message',
        chatId: 'chat-1',
        messageId: undefined,
        messages: expect.any(Array),
        message: expect.any(Object),
        isNewChat: false
      }
    })
  })
})
