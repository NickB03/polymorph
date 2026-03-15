import { describe, expect, it } from 'vitest'

import {
  buildChatRequestBody,
  getLatestGuestArtifactToken
} from './chat-request'

describe('chat request helpers', () => {
  it('extracts the latest guest artifact token from persisted artifact data parts', () => {
    const token = getLatestGuestArtifactToken([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'data-artifact',
            data: {
              id: 'artifact-1',
              title: 'App',
              status: 'ready',
              guestArtifactToken: 'older-token'
            }
          }
        ]
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'data-artifactStatus',
            data: {
              id: 'artifact-1',
              status: 'ready',
              guestArtifactToken: 'latest-token'
            }
          }
        ]
      }
    ] as any)

    expect(token).toBe('latest-token')
  })

  it('includes guestArtifactToken in guest submit-message requests', () => {
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
      guestArtifactToken: 'guest-token-123',
      savedMessagesCount: 0
    })

    expect(request).toEqual({
      body: expect.objectContaining({
        trigger: 'submit-message',
        chatId: 'chat-1',
        guestArtifactToken: 'guest-token-123'
      })
    })
  })

  it('includes guestArtifactToken in guest tool-result continuation requests', () => {
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
      guestArtifactToken: 'guest-token-123',
      savedMessagesCount: 2
    })

    expect(request).toEqual({
      body: {
        trigger: 'tool-result',
        chatId: 'chat-1',
        toolResult: {
          toolCallId: 'tool-1',
          output: { value: 'dark' }
        },
        messages: expect.any(Array),
        guestArtifactToken: 'guest-token-123'
      }
    })
  })
})
