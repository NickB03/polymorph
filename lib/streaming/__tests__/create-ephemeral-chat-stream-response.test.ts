import { describe, expect, it, vi } from 'vitest'

// Mock canvas service (transitively imports esbuild which fails in jsdom)
vi.mock('@/lib/canvas/service', () => ({
  createCanvasArtifactFromSource: vi.fn(),
  updateCanvasArtifactDraftFromSource: vi.fn(),
  loadCanvasArtifactState: vi.fn(),
  saveCanvasArtifactVersion: vi.fn()
}))

import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'

function makeModel() {
  return { providerId: 'openai', id: 'gpt-4o-mini' } as any
}

describe('createEphemeralChatStreamResponse', () => {
  it('returns 400 when messages are missing', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: [],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed'
    })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({
      code: 'BAD_REQUEST',
      error: 'messages are required'
    })
  })

  it('returns 400 when messages is undefined-ish (null cast)', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: null as unknown as any[],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed'
    })

    expect(response.status).toBe(400)
  })

  it('rejects when guest provides no conversation history', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: [],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed',
      chatId: 'ghost-chat-id',
      trigger: 'tool-result'
    })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('messages are required')
  })

  it('rejects when messages array contains no entries', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: [],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed',
      trigger: 'submit-message'
    })

    expect(response.status).toBe(400)
  })
})
