import { beforeEach, describe, expect, it, vi } from 'vitest'

const registryMocks = vi.hoisted(() => ({
  mockAgent: { stream: vi.fn() },
  createChatAgentById: vi.fn(),
  resolveChatAgentId: vi.fn()
}))

vi.mock('@/lib/agents/chat/registry', () => ({
  createChatAgentById: registryMocks.createChatAgentById,
  resolveChatAgentId: registryMocks.resolveChatAgentId
}))

vi.mock('@/lib/streaming/create-chat-stream-response', () => ({
  createChatStreamResponse: vi
    .fn()
    .mockResolvedValue(new Response('authenticated-stream'))
}))

vi.mock('@/lib/streaming/create-ephemeral-chat-stream-response', () => ({
  createEphemeralChatStreamResponse: vi
    .fn()
    .mockResolvedValue(new Response('guest-stream'))
}))

import { handleChatAgentRoute } from '@/lib/agents/chat/route-handler'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'
import type { UIMessage } from '@/lib/types/ai'

function makeModel() {
  return { providerId: 'gateway', id: 'gemini-3-flash' } as any
}

const userMessage: UIMessage = {
  id: 'user-1',
  role: 'user',
  parts: [{ type: 'text', text: 'hello' }]
}

describe('handleChatAgentRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registryMocks.resolveChatAgentId.mockReturnValue('research')
    registryMocks.createChatAgentById.mockReturnValue(registryMocks.mockAgent)
  })

  it('delegates authenticated requests to the persistent chat stream primitive', async () => {
    const signal = new AbortController().signal

    const response = await handleChatAgentRoute({
      isGuest: false,
      message: userMessage,
      messages: [userMessage],
      model: makeModel(),
      chatId: 'chat-1',
      userId: 'user-1',
      trigger: 'submit-message',
      abortSignal: signal,
      isNewChat: true,
      searchMode: 'research',
      userMode: 'research',
      modelType: 'quality'
    })

    await expect(response.text()).resolves.toBe('authenticated-stream')
    expect(createChatStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        message: userMessage,
        messages: [userMessage],
        model: expect.objectContaining({ id: 'gemini-3-flash' }),
        chatId: 'chat-1',
        userId: 'user-1',
        trigger: 'submit-message',
        abortSignal: signal,
        isNewChat: true,
        searchMode: 'research',
        userMode: 'research',
        modelType: 'quality',
        agentFactory: expect.any(Function)
      })
    )
    const streamConfig = vi.mocked(createChatStreamResponse).mock.calls[0][0]
    const agent = streamConfig.agentFactory({
      modelId: 'gateway:google/gemini-3-flash',
      correlationId: 'corr-1',
      otelTraceId: 'otel-1',
      parentTraceId: 'trace-1'
    })
    expect(agent).toBe(registryMocks.mockAgent)
    expect(registryMocks.resolveChatAgentId).toHaveBeenCalledWith({
      searchMode: 'research',
      userMode: 'research',
      intent: undefined
    })
    expect(registryMocks.createChatAgentById).toHaveBeenCalledWith(
      'research',
      expect.objectContaining({
        model: 'gateway:google/gemini-3-flash',
        modelConfig: expect.objectContaining({ id: 'gemini-3-flash' }),
        searchMode: 'research',
        userMode: 'research',
        modelType: 'quality',
        correlationId: 'corr-1',
        otelTraceId: 'otel-1',
        parentTraceId: 'trace-1'
      })
    )
    expect(createEphemeralChatStreamResponse).not.toHaveBeenCalled()
  })

  it('delegates guest requests to the ephemeral chat stream primitive', async () => {
    const signal = new AbortController().signal
    registryMocks.resolveChatAgentId.mockReturnValue('search')

    const response = await handleChatAgentRoute({
      isGuest: true,
      message: userMessage,
      messages: [userMessage],
      model: makeModel(),
      chatId: 'guest-chat-1',
      trigger: 'submit-message',
      abortSignal: signal,
      searchMode: 'chat',
      userMode: 'search',
      modelType: 'speed',
      guestCanvasToken: 'guest-token'
    })

    await expect(response.text()).resolves.toBe('guest-stream')
    expect(createEphemeralChatStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [userMessage],
        model: expect.objectContaining({ id: 'gemini-3-flash' }),
        chatId: 'guest-chat-1',
        trigger: 'submit-message',
        abortSignal: signal,
        searchMode: 'chat',
        userMode: 'search',
        modelType: 'speed',
        guestCanvasToken: 'guest-token',
        agentFactory: expect.any(Function)
      })
    )
    const streamConfig = vi.mocked(createEphemeralChatStreamResponse).mock
      .calls[0][0]
    const agent = streamConfig.agentFactory({
      modelId: 'gateway:google/gemini-3-flash',
      imageToolContext: { userId: 'guest', chatId: 'guest-chat-1' }
    })
    expect(agent).toBe(registryMocks.mockAgent)
    expect(registryMocks.resolveChatAgentId).toHaveBeenCalledWith({
      searchMode: 'chat',
      userMode: 'search',
      intent: undefined
    })
    expect(registryMocks.createChatAgentById).toHaveBeenCalledWith(
      'search',
      expect.objectContaining({
        model: 'gateway:google/gemini-3-flash',
        modelConfig: expect.objectContaining({ id: 'gemini-3-flash' }),
        searchMode: 'chat',
        userMode: 'search',
        modelType: 'speed',
        imageToolContext: { userId: 'guest', chatId: 'guest-chat-1' }
      })
    )
    expect(createChatStreamResponse).not.toHaveBeenCalled()
  })

  it('creates the build agent when validated context carries build intent', async () => {
    registryMocks.resolveChatAgentId.mockReturnValue('build')

    await handleChatAgentRoute({
      isGuest: false,
      message: userMessage,
      messages: [userMessage],
      model: makeModel(),
      chatId: 'build-chat',
      userId: 'user-1',
      trigger: 'submit-message',
      searchMode: 'chat',
      userMode: 'build',
      intent: 'build',
      modelType: 'quality'
    })

    const streamConfig = vi.mocked(createChatStreamResponse).mock.calls[0][0]
    streamConfig.agentFactory({
      modelId: 'gateway:google/gemini-3-flash',
      parentTraceId: 'trace-build'
    })

    expect(registryMocks.resolveChatAgentId).toHaveBeenCalledWith({
      searchMode: 'chat',
      userMode: 'build',
      intent: 'build'
    })
    expect(registryMocks.createChatAgentById).toHaveBeenCalledWith(
      'build',
      expect.objectContaining({
        model: 'gateway:google/gemini-3-flash',
        searchMode: 'chat',
        userMode: 'build',
        intent: 'build',
        modelType: 'quality',
        parentTraceId: 'trace-build'
      })
    )
  })
})
