import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWriter = {
  write: vi.fn(),
  merge: vi.fn()
}
const mockAgentStream = vi.fn()
const mockLoadCanvasArtifactByChatId = vi.fn()
const mockLoadChatWithMessages = vi.fn()
const mockPersistStreamResults = vi.fn()
const mockPrepareToolResultMessages = vi.fn()

vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>()

  return {
    ...actual,
    consumeStream: vi.fn(),
    convertToModelMessages: vi.fn(async (messages: unknown[]) => messages),
    createUIMessageStream: vi.fn(
      ({
        execute,
        onFinish
      }: {
        execute: (args: { writer: typeof mockWriter }) => Promise<void>
        onFinish?: (args: {
          responseMessage?: unknown
          isAborted?: boolean
        }) => Promise<void>
      }) => {
        void execute({ writer: mockWriter }).then(() =>
          onFinish?.({
            responseMessage: {
              id: 'assistant-1',
              role: 'assistant',
              parts: []
            }
          })
        )
        return { mocked: true }
      }
    ),
    createUIMessageStreamResponse: vi.fn(() => new Response('ok')),
    pruneMessages: vi.fn(({ messages }: { messages: unknown[] }) => messages),
    smoothStream: vi.fn(() => undefined)
  }
})

vi.mock('@/lib/actions/chat', () => ({
  loadChat: vi.fn()
}))

vi.mock('@/lib/agents/chat/message-contract', () => ({
  createChatValidationContract: vi.fn(() => ({
    validate: vi.fn(async (messages: unknown[]) => messages)
  }))
}))

vi.mock('@/lib/agents/researcher', () => ({
  researcher: vi.fn(() => {
    throw new Error('stream primitive must not construct researcher directly')
  })
}))

vi.mock('@/lib/db/actions', () => ({
  loadCanvasArtifactByChatId: (...args: unknown[]) =>
    mockLoadCanvasArtifactByChatId(...args),
  loadChatWithMessages: (...args: unknown[]) =>
    mockLoadChatWithMessages(...args)
}))

vi.mock('@/lib/agents/title-generator', () => ({
  generateChatTitle: vi.fn().mockResolvedValue('Generated title')
}))

vi.mock('@/lib/streaming/helpers/persist-stream-results', () => ({
  persistStreamResults: (...args: unknown[]) =>
    mockPersistStreamResults(...args)
}))

vi.mock('@/lib/streaming/helpers/prepare-messages', () => ({
  prepareMessages: vi.fn(
    async (_context: unknown, message: unknown, requestMessages?: unknown[]) =>
      requestMessages ?? [message]
  )
}))

vi.mock('@/lib/streaming/helpers/prepare-tool-result-messages', () => ({
  prepareToolResultMessages: (...args: unknown[]) =>
    mockPrepareToolResultMessages(...args),
  ToolResultValidationError: class ToolResultValidationError extends Error {}
}))

vi.mock('@/lib/streaming/helpers/inline-file-urls', () => ({
  inlineFileUrls: vi.fn(async (messages: unknown[]) => messages)
}))

vi.mock('@/lib/utils/context-window', () => ({
  maybeTruncateMessages: vi.fn((messages: unknown[]) => messages)
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn(),
  isTracingEnabled: vi.fn(() => false),
  withOtelSession: vi.fn(async (_context: unknown, callback: () => unknown) =>
    callback()
  )
}))

vi.mock('@/lib/streaming/helpers/stream-related-questions', () => ({
  streamRelatedQuestions: vi.fn()
}))

import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'

function makeModel() {
  return { providerId: 'openai', id: 'gpt-4o-mini' } as any
}

describe('createChatStreamResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadCanvasArtifactByChatId.mockResolvedValue({
      id: 'artifact-1',
      draftRevision: 3
    })
    mockLoadChatWithMessages.mockResolvedValue(null)
    mockPrepareToolResultMessages.mockReset()
    mockAgentStream.mockResolvedValue({
      toUIMessageStream: vi.fn(() => ({})),
      response: Promise.resolve({ messages: [] })
    })
  })

  it('uses the injected agent factory with authenticated canvas and image context', async () => {
    const agentFactory = vi.fn(() => ({ stream: mockAgentStream }) as any)

    const response = await createChatStreamResponse({
      message: {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }]
      },
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'hello' }]
        }
      ],
      model: makeModel(),
      chatId: 'chat-1',
      userId: 'user-1',
      trigger: 'submit-message',
      abortSignal: new AbortController().signal,
      isNewChat: true,
      searchMode: 'chat',
      userMode: 'search',
      modelType: 'speed',
      agentFactory
    })

    await expect(response.text()).resolves.toBe('ok')
    await vi.waitFor(() => {
      expect(agentFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'openai:gpt-4o-mini',
          writer: mockWriter,
          canvasToolContext: expect.objectContaining({
            chatId: 'chat-1',
            userId: 'user-1',
            isGuest: false,
            currentArtifact: {
              artifactId: 'artifact-1',
              draftRevision: 3
            }
          }),
          imageToolContext: {
            userId: 'user-1',
            chatId: 'chat-1'
          }
        })
      )
    })
    expect(mockAgentStream).toHaveBeenCalledTimes(1)
  })

  it('uses the injected agent factory for authenticated tool-result continuations', async () => {
    mockLoadChatWithMessages.mockResolvedValue({
      id: 'chat-1',
      userId: 'user-1',
      messages: []
    })
    mockPrepareToolResultMessages.mockResolvedValue([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-displayOptionList',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: { id: 'choice', options: [{ id: 'a', label: 'A' }] },
            output: 'a'
          }
        ]
      }
    ])
    const agentFactory = vi.fn(() => ({ stream: mockAgentStream }) as any)

    const response = await createChatStreamResponse({
      message: null,
      model: makeModel(),
      chatId: 'chat-1',
      userId: 'user-1',
      trigger: 'tool-result',
      toolResult: { toolCallId: 'tool-1', output: 'a' } as any,
      agentFactory
    })

    await expect(response.text()).resolves.toBe('ok')
    await vi.waitFor(() => {
      expect(mockLoadChatWithMessages).toHaveBeenCalledWith('chat-1', 'user-1')
      expect(mockPrepareToolResultMessages).toHaveBeenCalled()
      expect(agentFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'openai:gpt-4o-mini',
          writer: mockWriter,
          imageToolContext: { userId: 'user-1', chatId: 'chat-1' }
        })
      )
    })
    expect(mockAgentStream).toHaveBeenCalledTimes(1)
  })
})
