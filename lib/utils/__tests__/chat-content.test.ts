import { describe, expect, it } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { hasRenderableConversationContent } from '../chat-content'

describe('hasRenderableConversationContent', () => {
  it('returns false for messages backfilled with empty parts', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: []
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: []
      }
    ]

    expect(hasRenderableConversationContent(messages)).toBe(false)
  })

  it('returns false when messages only contain hidden canvas status parts', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'data-canvasArtifactStatus',
            data: {
              artifactId: 'artifact-1',
              chatId: 'chat-1',
              status: 'ready',
              draftRevision: 1,
              currentVersionId: null,
              updatedAt: '2026-05-28T00:00:00.000Z'
            }
          }
        ]
      }
    ]

    expect(hasRenderableConversationContent(messages)).toBe(false)
  })

  it('returns true for a non-empty user text part', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Best Italian restaurants in Dallas' }]
      }
    ]

    expect(hasRenderableConversationContent(messages)).toBe(true)
  })

  it('returns true for a persisted canvas artifact card part', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'data-canvasArtifact',
            data: {
              artifactId: 'artifact-1',
              chatId: 'chat-1',
              title: 'Dashboard',
              status: 'ready',
              draftRevision: 1,
              currentVersionId: null
            }
          }
        ]
      }
    ]

    expect(hasRenderableConversationContent(messages)).toBe(true)
  })
})
