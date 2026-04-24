import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWriter = {
  write: vi.fn(),
  merge: vi.fn()
}
const mockAgentStream = vi.fn()
const mockVerifyGuestCanvasToken = vi.fn()

vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>()

  return {
    ...actual,
    consumeStream: vi.fn(),
    convertToModelMessages: vi.fn(async (messages: unknown[]) => messages),
    createUIMessageStream: vi.fn(
      ({
        execute
      }: {
        execute: (args: { writer: typeof mockWriter }) => Promise<void>
      }) => {
        void execute({ writer: mockWriter })
        return { mocked: true }
      }
    ),
    createUIMessageStreamResponse: vi.fn(() => new Response('ok')),
    pruneMessages: vi.fn(({ messages }: { messages: unknown[] }) => messages),
    smoothStream: vi.fn(() => undefined)
  }
})

// Mock canvas service (transitively imports esbuild which fails in jsdom)
vi.mock('@/lib/canvas/service', () => ({
  createCanvasArtifactFromSource: vi.fn(),
  updateCanvasArtifactDraftFromSource: vi.fn(),
  loadCanvasArtifactState: vi.fn(),
  saveCanvasArtifactVersion: vi.fn()
}))

import { loadCanvasArtifactState } from '@/lib/canvas/service'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'

vi.mock('@/lib/agents/chat/registry', () => ({
  createChatAgent: vi.fn(() => {
    throw new Error('stream primitive must use the injected agentFactory')
  })
}))

vi.mock('@/lib/agents/researcher', () => ({
  researcher: vi.fn(() => {
    throw new Error('stream primitive must not construct researcher directly')
  })
}))

vi.mock('@/lib/canvas/guest-token', () => ({
  verifyGuestCanvasToken: (...args: unknown[]) =>
    mockVerifyGuestCanvasToken(...args)
}))

function makeModel() {
  return { providerId: 'openai', id: 'gpt-4o-mini' } as any
}

describe('createEphemeralChatStreamResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgentStream.mockResolvedValue({
      toUIMessageStream: vi.fn(() => ({})),
      response: Promise.resolve({ messages: [] })
    })
  })

  it('uses the injected agent factory with guest image context', async () => {
    const agentFactory = vi.fn(() => ({ stream: mockAgentStream }) as any)

    await createEphemeralChatStreamResponse({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Generate an image of a sunrise' }]
        }
      ],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed',
      chatId: 'guest-chat-1',
      trigger: 'submit-message',
      agentFactory
    })

    await vi.waitFor(() => {
      expect(agentFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'openai:gpt-4o-mini',
          writer: mockWriter,
          imageToolContext: {
            userId: 'guest',
            chatId: 'guest-chat-1'
          }
        })
      )
    })
    expect(agentFactory).toHaveBeenCalledTimes(1)
    expect(mockAgentStream).toHaveBeenCalledTimes(1)
  })

  it('hydrates guest currentArtifact before invoking the injected agent factory', async () => {
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: Date.now() + 60_000
    })
    vi.mocked(loadCanvasArtifactState).mockResolvedValue({
      artifactId: 'art-1',
      chatId: 'chat-1',
      title: 'Guest artifact',
      status: 'ready',
      draftRevision: 4,
      draftSource: {
        'App.tsx': 'export default function App() { return <div /> }'
      },
      draftCompiledHtml: '<html></html>',
      draftDiagnostics: null,
      currentVersionId: null,
      versions: [],
      updatedAt: '2026-03-21T00:00:00Z'
    })
    const agentFactory = vi.fn(() => ({ stream: mockAgentStream }) as any)

    await createEphemeralChatStreamResponse({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Update the current canvas artifact' }]
        }
      ],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed',
      chatId: 'chat-1',
      guestCanvasToken: 'valid-token',
      trigger: 'tool-result',
      agentFactory
    })

    await vi.waitFor(() => {
      expect(mockVerifyGuestCanvasToken).toHaveBeenCalledWith('valid-token')
      expect(loadCanvasArtifactState).toHaveBeenCalledWith({
        artifactId: 'art-1'
      })
    })
    expect(agentFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'openai:gpt-4o-mini',
        writer: mockWriter,
        canvasToolContext: expect.objectContaining({
          chatId: 'chat-1',
          userId: 'guest',
          isGuest: true,
          guestCanvasToken: 'valid-token',
          currentArtifact: expect.objectContaining({
            artifactId: 'art-1',
            draftRevision: 4
          })
        })
      })
    )
    expect(mockVerifyGuestCanvasToken).toHaveBeenCalledTimes(1)
    expect(loadCanvasArtifactState).toHaveBeenCalledTimes(1)
    expect(agentFactory).toHaveBeenCalledTimes(1)
    expect(mockAgentStream).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when messages are missing', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: [],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed',
      agentFactory: vi.fn()
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
      modelType: 'speed',
      agentFactory: vi.fn()
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
      trigger: 'tool-result',
      agentFactory: vi.fn()
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
      trigger: 'submit-message',
      agentFactory: vi.fn()
    })

    expect(response.status).toBe(400)
  })
})
