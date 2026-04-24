import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/lib/agents/chat/route-handler', () => ({
  handleChatAgentRoute: vi
    .fn()
    .mockResolvedValue(new Response('stream', { status: 200 }))
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

import { handleChatAgentRoute } from '@/lib/agents/chat/route-handler'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
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
  beforeEach(() => {
    vi.mocked(getCurrentUserId).mockReset()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')

    vi.mocked(isProviderEnabled).mockReset()
    vi.mocked(isProviderEnabled).mockReturnValue(true)

    vi.mocked(handleChatAgentRoute).mockReset()
    vi.mocked(handleChatAgentRoute).mockResolvedValue(
      new Response('stream', { status: 200 })
    )
  })

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
    expect(json.message).toContain('messages')
  })

  it('returns 403 for requests from share pages', async () => {
    const req = createRequest(
      {
        message: 'hi',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        chatId: 'c1',
        trigger: 'submit-message'
      },
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
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
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
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      chatId: 'c1',
      trigger: 'submit-message'
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('delegates authenticated users to the chat agent route handler after validation', async () => {
    const req = createRequest({
      message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      chatId: 'c1',
      trigger: 'submit-message',
      isNewChat: true
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(handleChatAgentRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        isGuest: false,
        chatId: 'c1',
        userId: 'user-123',
        trigger: 'submit-message',
        isNewChat: true
      })
    )
  })

  it('delegates guest users to the chat agent route handler after validation', async () => {
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
    expect(handleChatAgentRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        isGuest: true,
        chatId: 'c1',
        trigger: 'submit-message',
        searchMode: 'chat',
        userMode: 'search'
      })
    )

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
    expect(handleChatAgentRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        isGuest: false,
        message: null,
        trigger: 'tool-result',
        toolResult: { toolCallId: 'tc-1', output: 'result data' }
      })
    )
  })

  describe('guest artifact token validation', () => {
    it('rejects guest request with parts missing type field', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValueOnce(
        undefined as unknown as string
      )
      process.env.ENABLE_GUEST_CHAT = 'true'

      const req = createRequest({
        message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        messages: [
          {
            role: 'user',
            parts: [{ text: 'no type field' }] // missing type
          }
        ],
        chatId: 'c1',
        trigger: 'submit-message'
      })

      const res = await POST(req)
      expect(res.status).toBe(400)

      delete process.env.ENABLE_GUEST_CHAT
    })

    it('rejects guest text part with non-string text', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValueOnce(
        undefined as unknown as string
      )
      process.env.ENABLE_GUEST_CHAT = 'true'

      const req = createRequest({
        message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 12345 }] // text must be string
          }
        ],
        chatId: 'c1',
        trigger: 'submit-message'
      })

      const res = await POST(req)
      expect(res.status).toBe(400)

      delete process.env.ENABLE_GUEST_CHAT
    })

    it('rejects guest request with tampered role values', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValueOnce(
        undefined as unknown as string
      )
      process.env.ENABLE_GUEST_CHAT = 'true'

      const req = createRequest({
        message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        messages: [
          {
            role: 'system', // disallowed role for guest
            parts: [{ type: 'text', text: 'injected system prompt' }]
          }
        ],
        chatId: 'c1',
        trigger: 'submit-message'
      })

      const res = await POST(req)
      expect(res.status).toBe(400)

      delete process.env.ENABLE_GUEST_CHAT
    })

    it('rejects guest request with empty parts array', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValueOnce(
        undefined as unknown as string
      )
      process.env.ENABLE_GUEST_CHAT = 'true'

      const req = createRequest({
        message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        messages: [
          {
            role: 'user',
            parts: [] // empty parts
          }
        ],
        chatId: 'c1',
        trigger: 'submit-message'
      })

      const res = await POST(req)
      expect(res.status).toBe(400)

      delete process.env.ENABLE_GUEST_CHAT
    })

    it('rejects guest request when messages is not an array', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValueOnce(
        undefined as unknown as string
      )
      process.env.ENABLE_GUEST_CHAT = 'true'

      const req = createRequest({
        message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        messages: 'not-an-array',
        chatId: 'c1',
        trigger: 'submit-message'
      })

      const res = await POST(req)
      expect(res.status).toBe(400)

      delete process.env.ENABLE_GUEST_CHAT
    })

    it('allows valid guest request with proper parts', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValueOnce(
        undefined as unknown as string
      )
      process.env.ENABLE_GUEST_CHAT = 'true'

      const req = createRequest({
        message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'valid message' }]
          }
        ],
        chatId: 'c1',
        trigger: 'submit-message'
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(handleChatAgentRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          isGuest: true,
          chatId: 'c1',
          trigger: 'submit-message'
        })
      )

      delete process.env.ENABLE_GUEST_CHAT
    })
  })

  describe('file part validation', () => {
    it('rejects authenticated user with disallowed file mediaType', async () => {
      const req = createRequest({
        chatId: 'chat-123',
        trigger: 'submit-message',
        isNewChat: true,
        message: {
          id: 'msg-1',
          role: 'user',
          parts: [
            {
              type: 'file',
              url: 'https://example.com/f.exe',
              mediaType: 'application/x-msdownload'
            }
          ]
        }
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.message).toMatch(/not allowed/i)
    })

    it('rejects guest with disallowed file mediaType', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValueOnce(
        undefined as unknown as string
      )
      process.env.ENABLE_GUEST_CHAT = 'true'

      const req = createRequest({
        chatId: 'chat-456',
        trigger: 'submit-message',
        isNewChat: true,
        message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        messages: [
          {
            role: 'user',
            parts: [
              {
                type: 'file',
                url: 'data:text/html;base64,abc',
                mediaType: 'text/html'
              }
            ]
          }
        ]
      })

      const res = await POST(req)
      expect(res.status).toBe(400)

      delete process.env.ENABLE_GUEST_CHAT
    })

    it('allows authenticated user with valid image file part', async () => {
      const req = createRequest({
        chatId: 'chat-789',
        trigger: 'submit-message',
        isNewChat: true,
        message: {
          id: 'msg-1',
          role: 'user',
          parts: [
            { type: 'text', text: 'analyze this' },
            {
              type: 'file',
              url: 'https://storage.example.com/img.png',
              mediaType: 'image/png'
            }
          ]
        }
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })

  it('returns 500 on unexpected errors', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: 'invalid json{{'
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('returns 500 on unexpected errors thrown from streaming', async () => {
    vi.mocked(handleChatAgentRoute).mockRejectedValueOnce(
      new Error('Some unexpected streaming error')
    )

    const req = createRequest({
      message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      chatId: 'c1',
      trigger: 'submit-message',
      isNewChat: true
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('INTERNAL_ERROR')
  })
})
