import { describe, expect, it, vi } from 'vitest'

import { persistStreamResults } from '@/lib/streaming/helpers/persist-stream-results'

vi.mock('@/lib/actions/chat', () => ({
  createChatWithFirstMessage: vi.fn(),
  upsertMessage: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/db/actions', () => ({
  updateChatTitle: vi.fn().mockResolvedValue(undefined),
  upsertMessage: vi.fn()
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
import { upsertMessage as upsertMessageIfCurrent } from '@/lib/db/actions'

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

  it('skips cache revalidation when the stale guard drops an aborted partial', async () => {
    vi.mocked(revalidateTag).mockClear()
    vi.mocked(upsertMessage).mockClear()
    vi.mocked(upsertMessageIfCurrent).mockResolvedValue(null)
    const staleGuard = { latestId: 'user-msg-1', since: new Date() }

    await persistStreamResults(
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'partial' }]
      } as Parameters<typeof persistStreamResults>[0],
      'chat-1',
      'user-1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      staleGuard
    )

    expect(upsertMessageIfCurrent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-2', chatId: 'chat-1' }),
      'user-1',
      staleGuard
    )
    expect(upsertMessage).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
