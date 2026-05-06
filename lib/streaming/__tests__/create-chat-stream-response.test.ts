import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWriter = {
  write: vi.fn(),
  merge: vi.fn()
}
const mockAgentStream = vi.fn()
const mockLoadCanvasArtifactByChatId = vi.fn()
const mockLoadChatWithMessages = vi.fn()
const mockPersistStreamResults = vi.fn()
const mockWithOtelRootSpan = vi.hoisted(() =>
  vi.fn(async (...args: unknown[]) => {
    const callback = args[1] as (context: unknown) => unknown
    return callback({ otelTraceId: 'otel-trace-1' })
  })
)

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
  prepareMessages: vi.fn(async (context: any, requestMessages?: unknown[]) => {
    if (context?.isNewChat && requestMessages?.[0]) {
      context.pendingInitialSave = Promise.resolve({})
      context.pendingInitialUserMessage = requestMessages[0]
    }

    return requestMessages ?? []
  })
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
  withOtelRootSpan: mockWithOtelRootSpan
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
    mockWithOtelRootSpan.mockClear()
    mockAgentStream.mockResolvedValue({
      toUIMessageStream: vi.fn(() => ({})),
      response: Promise.resolve({ messages: [] })
    })
  })

  it('uses the injected agent factory with authenticated canvas and image context', async () => {
    const agentFactory = vi.fn(() => ({ stream: mockAgentStream }) as any)

    const response = await createChatStreamResponse({
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
          correlationId: expect.any(String),
          otelTraceId: 'otel-trace-1',
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
    await vi.waitFor(() => {
      expect(mockPersistStreamResults).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'assistant-1' }),
        'chat-1',
        'user-1',
        expect.any(Promise),
        expect.any(String),
        'search',
        'openai:gpt-4o-mini',
        expect.any(Promise),
        expect.objectContaining({ id: 'user-1' }),
        'speed',
        'otel-trace-1'
      )
    })
  })

  it('uses the injected agent factory for native authenticated tool-output continuations', async () => {
    const updatedAssistant = {
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
    mockLoadChatWithMessages.mockResolvedValue({
      id: 'chat-1',
      userId: 'user-1',
      messages: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'pick one' }]
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-displayOptionList',
              toolCallId: 'tool-1',
              state: 'input-available',
              input: { id: 'choice', options: [{ id: 'a', label: 'A' }] }
            }
          ]
        }
      ]
    })
    const requestMessages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'pick one' }]
      },
      updatedAssistant
    ]
    const agentFactory = vi.fn(() => ({ stream: mockAgentStream }) as any)

    const response = await createChatStreamResponse({
      messages: requestMessages as any,
      model: makeModel(),
      chatId: 'chat-1',
      userId: 'user-1',
      trigger: 'submit-message',
      messageId: 'assistant-1',
      agentFactory
    })

    await expect(response.text()).resolves.toBe('ok')
    await vi.waitFor(() => {
      expect(mockLoadChatWithMessages).toHaveBeenCalledWith('chat-1', 'user-1')
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
