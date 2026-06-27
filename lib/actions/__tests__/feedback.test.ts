import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the modules before any imports
vi.mock('@/lib/db')

// Import after mocking
import { db } from '@/lib/db'

import { updateMessageFeedback } from '../feedback'

describe('Feedback Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateMessageFeedback', () => {
    it('should update message feedback successfully', async () => {
      const messageId = 'test-message-id'
      const chatId = 'test-chat-id'
      const score = 1

      // Mock db.select
      const mockLimit = vi.fn().mockResolvedValue([
        {
          metadata: { traceId: 'test-trace-id' },
          chatId
        }
      ])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      // Mock db.update
      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
      vi.mocked(db).update = vi.fn().mockReturnValue({ set: mockSet })

      const result = await updateMessageFeedback(messageId, score)

      expect(result).toEqual({
        success: true,
        chatId,
        metadata: { traceId: 'test-trace-id' }
      })
      expect(db.select).toHaveBeenCalled()
      expect(db.update).toHaveBeenCalled()
    })

    it('should return error when message not found', async () => {
      const messageId = 'non-existent-id'
      const score = 1

      // Mock empty database response
      const mockLimit = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await updateMessageFeedback(messageId, score)

      expect(result).toEqual({
        success: false,
        error: 'Message not found'
      })
    })

    it('should handle errors gracefully', async () => {
      const messageId = 'test-message-id'
      const score = -1

      // Mock database error
      const mockLimit = vi.fn().mockRejectedValue(new Error('Database error'))
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await updateMessageFeedback(messageId, score)

      expect(result.success).toBe(false)
      if (result.success) {
        throw new Error('expected feedback update to fail')
      }
      expect(result.error).toBe('Database error')
    })
  })
})
