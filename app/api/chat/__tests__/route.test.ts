import { describe, expect, it, vi } from 'vitest'

// Mock all dependencies
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn()
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined)
  })
}))

vi.mock('@/lib/actions/chat', () => ({
  loadChat: vi.fn().mockResolvedValue(null)
}))

vi.mock('@/lib/analytics', () => ({
  calculateConversationTurn: vi.fn().mockReturnValue(1),
  trackChatEvent: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-123')
}))

vi.mock('@/lib/rate-limit/chat-limits', () => ({
  checkAndEnforceOverallChatLimit: vi.fn().mockResolvedValue(null)
}))

vi.mock('@/lib/rate-limit/guest-limit', () => ({
  checkAndEnforceGuestLimit: vi.fn().mockResolvedValue(null)
}))

vi.mock('@/lib/streaming/create-chat-stream-response', () => ({
  createChatStreamResponse: vi
    .fn()
    .mockResolvedValue(new Response('stream', { status: 200 }))
}))

vi.mock('@/lib/streaming/create-ephemeral-chat-stream-response', () => ({
  createEphemeralChatStreamResponse: vi
    .fn()
    .mockResolvedValue(new Response('ephemeral-stream', { status: 200 }))
}))

vi.mock('@/lib/utils/model-selection', () => ({
  selectModel: vi.fn().mockReturnValue({
    id: 'gemini-3-flash',
    providerId: 'gateway'
  })
}))

vi.mock('@/lib/utils/perf-logging', () => ({
  perfLog: vi.fn(),
  perfTime: vi.fn()
}))

vi.mock('@/lib/utils/perf-tracking', () => ({
  resetAllCounters: vi.fn()
}))

vi.mock('@/lib/utils/registry', () => ({
  isProviderEnabled: vi.fn().mockReturnValue(true)
}))

vi.mock('@/lib/utils/json-error', () => ({
  jsonError: vi.fn(
    (code: string, message: string, status: number) =>
      new Response(JSON.stringify({ error: code, message }), { status })
  )
}))

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'
import { isProviderEnabled } from '@/lib/utils/registry'

import { POST } from '@/app/api/chat/route'

function createRequest(body: any, headers?: Record<string, string>): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
}

describe('POST /api/chat', () => {
  it('returns 400 for unknown trigger', async () => {
    const req = createRequest({
      message: 'hi',
      chatId: 'c1',
      trigger: 'invalid-trigger'
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('BAD_REQUEST')
  })

  it('returns 400 when regenerate-message lacks messageId', async () => {
    const req = createRequest({
      chatId: 'c1',
      trigger: 'regenerate-message'
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toContain('messageId')
  })

  it('returns 400 when tool-result lacks required fields', async () => {
    const req = createRequest({
      chatId: 'c1',
      trigger: 'tool-result',
      toolResult: { toolCallId: '', output: 'data' }
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when submit-message lacks message', async () => {
    const req = createRequest({
      chatId: 'c1',
      trigger: 'submit-message'
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toContain('message')
  })

  it('returns 403 for requests from share pages', async () => {
    const req = createRequest(
      { message: 'hi', chatId: 'c1', trigger: 'submit-message' },
      { referer: 'http://localhost/share/abc123' }
    )

    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 401 when guest chat is disabled and user is not authenticated', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValueOnce(
      undefined as unknown as string
    )
    delete process.env.ENABLE_GUEST_CHAT

    const req = createRequest({
      message: 'hi',
      chatId: 'c1',
      trigger: 'submit-message'
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 404 when provider is not enabled', async () => {
    vi.mocked(isProviderEnabled).mockReturnValueOnce(false)

    const req = createRequest({
      message: 'hi',
      chatId: 'c1',
      trigger: 'submit-message'
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('calls createChatStreamResponse for authenticated users', async () => {
    const req = createRequest({
      message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      chatId: 'c1',
      trigger: 'submit-message',
      isNewChat: true
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(createChatStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'c1',
        userId: 'user-123',
        trigger: 'submit-message',
        isNewChat: true
      })
    )
  })

  it('calls createEphemeralChatStreamResponse for guest users', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValueOnce(
      undefined as unknown as string
    )
    process.env.ENABLE_GUEST_CHAT = 'true'

    const req = createRequest({
      message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      messages: [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'hello' }]
        }
      ],
      chatId: 'c1',
      trigger: 'submit-message'
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(createEphemeralChatStreamResponse).toHaveBeenCalled()

    delete process.env.ENABLE_GUEST_CHAT
  })

  it('validates guest message shape', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValueOnce(
      undefined as unknown as string
    )
    process.env.ENABLE_GUEST_CHAT = 'true'

    const req = createRequest({
      message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      messages: [{ role: 'user', parts: [] }], // empty parts = invalid
      chatId: 'c1',
      trigger: 'submit-message'
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    delete process.env.ENABLE_GUEST_CHAT
  })

  it('handles tool-result trigger correctly', async () => {
    const req = createRequest({
      chatId: 'c1',
      trigger: 'tool-result',
      toolResult: { toolCallId: 'tc-1', output: 'result data' }
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(createChatStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        message: null,
        trigger: 'tool-result',
        toolResult: { toolCallId: 'tc-1', output: 'result data' }
      })
    )
  })

  it('returns 500 on unexpected errors', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: 'invalid json{{'
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
