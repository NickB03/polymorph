import { describe, expect, it } from 'vitest'

import { buildChatRequestBody } from './chat-request'

describe('chat request helpers', () => {
  const retiredToolOutputField = ['tool', 'Result'].join('')
  const retiredHyphenatedToolOutputField = 'tool-result'

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

  it('keeps completed displayOptionList output on the native submit-message flow', () => {
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
              input: {
                id: 'theme',
                options: [
                  { id: 'dark', label: 'Dark' },
                  { id: 'light', label: 'Light' }
                ]
              },
              output: 'dark'
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
    expect(request.body).not.toHaveProperty(retiredHyphenatedToolOutputField)
  })

  it('keeps completed displayQuestionWizard output on the native submit-message flow', () => {
    const request = buildChatRequestBody({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'choose project settings' }]
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-displayQuestionWizard',
              toolCallId: 'wizard-1',
              state: 'output-available',
              input: {
                id: 'project-settings',
                steps: [
                  {
                    id: 'style',
                    title: 'Style',
                    options: [{ id: 'minimal', label: 'Minimal' }]
                  },
                  {
                    id: 'density',
                    title: 'Density',
                    options: [{ id: 'compact', label: 'Compact' }]
                  }
                ]
              },
              output: { style: 'minimal', density: 'compact' }
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
        chatId: 'chat-1',
        messageId: 'assistant-1',
        messages: expect.any(Array),
        isNewChat: false
      })
    )
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
    expect(request.body).not.toHaveProperty(retiredHyphenatedToolOutputField)
  })
})
