import { describe, expect, it, vi } from 'vitest'

import { persistStreamResults } from '@/lib/streaming/helpers/persist-stream-results'

vi.mock('@/lib/actions/chat', () => ({
  createChatWithFirstMessage: vi.fn(),
  upsertMessage: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/db/actions', () => ({
  updateChatTitle: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

vi.mock('@/lib/utils/perf-logging', () => ({
  perfTime: vi.fn(),
  perfLog: vi.fn()
}))

vi.mock('@/lib/utils/retry', () => ({
  retryDatabaseOperation: vi.fn()
}))

import { revalidateTag } from 'next/cache'

import { upsertMessage } from '@/lib/actions/chat'

describe('persistStreamResults', () => {
  it('writes modelType onto assistant message metadata when provided', async () => {
    const responseMessage = {
      id: 'msg-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'hi' }]
    } as Parameters<typeof persistStreamResults>[0]

    await persistStreamResults(
      responseMessage,
      'chat-1',
      'user-1',
      undefined,
      'corr-1',
      'search',
      'openrouter:anthropic/claude-haiku-4.5',
      undefined,
      undefined,
      'quality',
      'otel-1'
    )

    expect(upsertMessage).toHaveBeenCalledWith(
      'chat-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          correlationId: 'corr-1',
          otelTraceId: 'otel-1',
          userMode: 'search',
          modelId: 'openrouter:anthropic/claude-haiku-4.5',
          modelType: 'quality'
        })
      }),
      'user-1'
    )
    expect(revalidateTag).toHaveBeenCalledWith('chat-chat-1', { expire: 0 })
  })
})
