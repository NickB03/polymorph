import { describe, expect, it } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import {
  buildUIMessageFromDB,
  mapUIMessageToDBMessage
} from '../message-mapping'

describe('message mapping canonical UIMessage storage', () => {
  it('stores the canonical uiMessage payload on the message row', () => {
    const message: UIMessage & { chatId: string } = {
      id: 'msg-1',
      chatId: 'chat-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello world' }],
      metadata: { modelId: 'gateway:test-model' }
    }

    const mapped = mapUIMessageToDBMessage(message)

    expect(mapped).toMatchObject({
      id: 'msg-1',
      chatId: 'chat-1',
      role: 'assistant',
      uiMessage: {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'hello world' }]
      }
    })
  })

  it('rebuilds message from stored uiMessage payload and merges metadata', () => {
    const rebuilt = buildUIMessageFromDB({
      id: 'msg-1',
      role: 'assistant',
      uiMessage: {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'canonical payload' }],
        metadata: { modelId: 'gateway:model-a' }
      },
      metadata: { traceId: 'trace-1' },
      createdAt: '2026-04-23T12:00:00.000Z'
    })

    expect(rebuilt.parts).toEqual([{ type: 'text', text: 'canonical payload' }])
    expect(rebuilt.metadata).toMatchObject({
      modelId: 'gateway:model-a',
      traceId: 'trace-1'
    })
  })
})
