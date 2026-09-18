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

import { createChatWithFirstMessage, upsertMessage } from '@/lib/actions/chat'
import {
  updateChatTitle,
  upsertMessage as upsertMessageIfCurrent
} from '@/lib/db/actions'

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

  it("does not apply the stale response's title when the guard drops it", async () => {
    vi.mocked(updateChatTitle).mockClear()
    vi.mocked(upsertMessageIfCurrent).mockResolvedValue(null)

    await persistStreamResults(
      {
        id: 'msg-3',
        role: 'assistant',
        parts: [{ type: 'text', text: 'partial' }]
      } as Parameters<typeof persistStreamResults>[0],
      'chat-1',
      'user-1',
      Promise.resolve('Stale title'),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { latestId: 'user-msg-1', since: new Date() }
    )

    expect(updateChatTitle).not.toHaveBeenCalled()
  })

  it("writes nothing when duplicate-key recovery hits another user's chat", async () => {
    vi.mocked(upsertMessage).mockClear()
    vi.mocked(updateChatTitle).mockClear()
    vi.mocked(revalidateTag).mockClear()
    const duplicateKey = new Error(
      'duplicate key value violates unique constraint "chats_pkey"'
    )
    vi.mocked(createChatWithFirstMessage).mockRejectedValueOnce(duplicateKey)
    // The DB-level owner guard rejects the recovery upsert.
    vi.mocked(upsertMessage).mockRejectedValueOnce(new Error('Unauthorized'))
    const userMessage = {
      id: 'user-msg-1',
      role: 'user',
      parts: [{ type: 'text', text: 'injected' }]
    } as Parameters<typeof persistStreamResults>[0]

    await persistStreamResults(
      {
        id: 'msg-4',
        role: 'assistant',
        parts: [{ type: 'text', text: 'reply' }]
      } as Parameters<typeof persistStreamResults>[0],
      'victim-chat',
      'attacker',
      Promise.resolve('Attacker title'),
      undefined,
      undefined,
      undefined,
      Promise.reject(duplicateKey),
      userMessage
    )

    // Only the rejected recovery attempt: no assistant reply, no title.
    expect(upsertMessage).toHaveBeenCalledTimes(1)
    expect(upsertMessage).toHaveBeenCalledWith(
      'victim-chat',
      userMessage,
      'attacker'
    )
    expect(updateChatTitle).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("recovers the owner's own chat after a duplicate key", async () => {
    vi.mocked(upsertMessage).mockClear()
    vi.mocked(upsertMessage).mockResolvedValue(
      {} as Awaited<ReturnType<typeof upsertMessage>>
    )
    const duplicateKey = new Error('duplicate key value violates unique')
    vi.mocked(createChatWithFirstMessage).mockRejectedValueOnce(duplicateKey)

    await persistStreamResults(
      {
        id: 'msg-5',
        role: 'assistant',
        parts: [{ type: 'text', text: 'reply' }]
      } as Parameters<typeof persistStreamResults>[0],
      'chat-1',
      'user-1',
      undefined,
      undefined,
      undefined,
      undefined,
      Promise.reject(duplicateKey),
      {
        id: 'user-msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hi' }]
      } as Parameters<typeof persistStreamResults>[0]
    )

    // Initial user message, then the assistant reply.
    expect(upsertMessage).toHaveBeenCalledTimes(2)
  })
})
