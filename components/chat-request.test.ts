import { describe, expect, it } from 'vitest'

import { buildChatRequestBody } from './chat-request'

describe('chat request helpers', () => {
  const retiredToolOutputField = ['tool', 'Result'].join('')

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

  it('keeps completed interactive tool output on the native submit-message flow', () => {
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
        trigger: 'submit-message',
        chatId: 'chat-1',
        messageId: 'assistant-1',
        messages: expect.any(Array),
        isNewChat: false
      }
    })
    expect(request.body).not.toHaveProperty('message')
    expect(request.body).not.toHaveProperty(retiredToolOutputField)
  })

  it('does not send retired singular message or tool output fields for normal submissions', () => {
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
    expect(request.body).not.toHaveProperty('message')
    expect(request.body).not.toHaveProperty(retiredToolOutputField)
  })
})
