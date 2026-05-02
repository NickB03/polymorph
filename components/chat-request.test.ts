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

  it('maps completed interactive tool output to a tool-result continuation', () => {
    const request = buildChatRequestBody({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'choose one' }]
        },
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
      messageId: 'assistant-1',
      chatId: 'chat-1',
      isGuest: false,
      savedMessagesCount: 2
    })

    expect(request).toEqual({
      body: {
        trigger: 'tool-result',
        chatId: 'chat-1',
        messageId: 'assistant-1',
        messages: expect.any(Array),
        toolResult: {
          toolCallId: 'tool-1',
          output: { value: 'dark' }
        }
      }
    })
  })

  it('does not map completed non-interactive tool output to a tool-result continuation', () => {
    const request = buildChatRequestBody({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'search this' }]
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-search',
              toolCallId: 'tool-1',
              state: 'output-available',
              output: { results: [] }
            }
          ]
        }
      ] as any,
      trigger: 'submit-message',
      messageId: 'assistant-1',
      chatId: 'chat-1',
      isGuest: false,
      savedMessagesCount: 2
    })

    expect(request.body).toEqual(
      expect.objectContaining({
        trigger: 'submit-message',
        chatId: 'chat-1'
      })
    )
    expect(request.body).not.toHaveProperty('toolResult')
  })
})
