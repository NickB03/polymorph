import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Next.js cookies API
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => [])
  }))
}))

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: null })
      )
    }
  }))
}))

// Mock the modules
vi.mock('@/lib/actions/feedback', () => ({
  updateMessageFeedback: vi.fn()
}))

// Import after mocking
import { updateMessageFeedback } from '@/lib/actions/feedback'

import { POST } from '../route'

describe('Feedback API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/feedback', () => {
    it('should record feedback successfully', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true
      })

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: 1,
          comment: 'Great!',
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('Feedback recorded successfully')
      expect(updateMessageFeedback).toHaveBeenCalledWith(
        'test-message-id',
        1,
        null
      )
    })

    it('should handle negative feedback', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true
      })

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: -1,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(updateMessageFeedback).toHaveBeenCalledWith(
        'test-message-id',
        -1,
        null
      )
    })

    it('should return 400 for invalid score', async () => {
      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: 0,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(400)
      expect(text).toBe('score must be 1 (good) or -1 (bad)')
    })

    it('should work without traceId', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true
      })

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: 1,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('Feedback recorded successfully')
      expect(updateMessageFeedback).toHaveBeenCalledWith(
        'test-message-id',
        1,
        null
      )
    })

    it('should continue even if database update fails', async () => {
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: false,
        error: 'Database error'
      })

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: 1,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating message feedback:',
        'Database error'
      )

      consoleErrorSpy.mockRestore()
    })

    it('should work without messageId', async () => {
      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: 1
        })
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(updateMessageFeedback).not.toHaveBeenCalled()
    })

    it('should handle JSON parsing errors', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
