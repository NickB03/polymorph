import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Next.js cookies API
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => [])
  }))
}))

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn()
}))

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser } }))
}))

// Mock the modules
vi.mock('@/lib/actions/feedback', () => ({
  updateMessageFeedback: vi.fn()
}))

vi.mock('@/lib/observability/phoenix-feedback', () => ({
  annotatePhoenixUserFeedback: vi.fn()
}))

vi.mock('@/lib/rate-limit/feedback-limits', () => ({
  checkFeedbackLimit: vi.fn()
}))

// Import after mocking
import { updateMessageFeedback } from '@/lib/actions/feedback'
import { annotatePhoenixUserFeedback } from '@/lib/observability/phoenix-feedback'
import { checkFeedbackLimit } from '@/lib/rate-limit/feedback-limits'

import { POST } from '../route'

function feedbackRequest(body: unknown) {
  return new Request('http://localhost:3000/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('Feedback API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    })
    vi.mocked(checkFeedbackLimit).mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: 0,
      limit: 5
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('POST /api/feedback', () => {
    it('should record feedback successfully', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true,
        chatId: 'chat-1',
        metadata: {
          correlationId: 'corr-1',
          otelTraceId: 'otel-1'
        }
      })
      vi.mocked(annotatePhoenixUserFeedback).mockResolvedValue(undefined)

      const response = await POST(
        feedbackRequest({
          score: 1,
          comment: 'Great!',
          messageId: 'test-message-id'
        })
      )
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('Feedback recorded successfully')
      expect(updateMessageFeedback).toHaveBeenCalledWith(
        'test-message-id',
        1,
        'user-1'
      )
      expect(annotatePhoenixUserFeedback).toHaveBeenCalledWith({
        chatId: 'chat-1',
        messageId: 'test-message-id',
        score: 1,
        metadata: {
          correlationId: 'corr-1',
          otelTraceId: 'otel-1'
        }
      })
    })

    it('should handle negative feedback', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true,
        chatId: 'chat-1',
        metadata: null
      })

      const response = await POST(
        feedbackRequest({ score: -1, messageId: 'test-message-id' })
      )

      expect(response.status).toBe(200)
      expect(updateMessageFeedback).toHaveBeenCalledWith(
        'test-message-id',
        -1,
        'user-1'
      )
    })

    it('should return 401 for anonymous callers', async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: null })

      const response = await POST(
        feedbackRequest({ score: 1, messageId: 'someone-elses-message' })
      )

      expect(response.status).toBe(401)
      expect(updateMessageFeedback).not.toHaveBeenCalled()
    })

    it('should return 429 when rate limited', async () => {
      vi.mocked(checkFeedbackLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: 0,
        limit: 5
      })

      const response = await POST(
        feedbackRequest({ score: 1, messageId: 'test-message-id' })
      )

      expect(response.status).toBe(429)
      expect(updateMessageFeedback).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid score', async () => {
      const response = await POST(
        feedbackRequest({ score: 0, messageId: 'test-message-id' })
      )
      const text = await response.text()

      expect(response.status).toBe(400)
      expect(text).toBe('score must be 1 (good) or -1 (bad)')
    })

    it('should continue if Phoenix annotation fails', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true,
        chatId: 'chat-1',
        metadata: { correlationId: 'corr-1' }
      })
      vi.mocked(annotatePhoenixUserFeedback).mockRejectedValue(
        new Error('phoenix down')
      )
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      const response = await POST(
        feedbackRequest({ score: 1, messageId: 'test-message-id' })
      )

      expect(response.status).toBe(200)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[feedback] Phoenix annotation failed:',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })

    it('should report a failed database update', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: false,
        error: 'Database error'
      })

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const response = await POST(
        feedbackRequest({ score: 1, messageId: 'test-message-id' })
      )

      expect(response.status).toBe(404)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating message feedback:',
        'Database error'
      )

      consoleErrorSpy.mockRestore()
    })

    it('should return 400 without messageId', async () => {
      const response = await POST(feedbackRequest({ score: 1 }))

      expect(response.status).toBe(400)
      expect(updateMessageFeedback).not.toHaveBeenCalled()
    })

    it('should handle JSON parsing errors', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(500)
      expect(text).toBe('Error recording feedback')
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })
})
