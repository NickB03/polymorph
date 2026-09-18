import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the modules before any imports
vi.mock('@/lib/db')
// The transaction body runs against the mocked db; the GUC is irrelevant here.
vi.mock('@/lib/db/with-rls', () => ({
  withRLS: vi.fn(async (_userId: string, callback: (tx: unknown) => unknown) =>
    callback(db)
  )
}))

// Import after mocking
import { db } from '@/lib/db'

import { updateMessageFeedback } from '../feedback'

const userId = 'owner-user'

// select().from(messages).innerJoin(chats, ...).where(...).limit(1)
function mockJoinedFrom(where: unknown) {
  return vi
    .fn()
    .mockReturnValue({ innerJoin: vi.fn().mockReturnValue({ where }) })
}

function renderSql(expression: unknown) {
  return new PgDialect().sqlToQuery(expression as never)
}

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
      const mockFrom = mockJoinedFrom(mockWhere)
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      // Mock db.update
      const mockReturning = vi.fn().mockResolvedValue([{ id: messageId }])
      const mockUpdateWhere = vi
        .fn()
        .mockReturnValue({ returning: mockReturning })
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
      vi.mocked(db).update = vi.fn().mockReturnValue({ set: mockSet })

      const result = await updateMessageFeedback(messageId, score, userId)

      expect(result).toEqual({
        success: true,
        chatId,
        metadata: { traceId: 'test-trace-id' }
      })
      expect(db.select).toHaveBeenCalled()
      expect(db.update).toHaveBeenCalled()

      // Ownership is an explicit predicate, not just RLS: the read requires
      // the message's chat to belong to the caller, and the write is pinned
      // to that verified chat.
      const selectWhere = renderSql(mockWhere.mock.calls[0][0])
      expect(selectWhere.sql).toContain('"messages"."id" = $1')
      expect(selectWhere.sql).toContain('"chats"."user_id" = $2')
      expect(selectWhere.params).toEqual([messageId, userId])
      const updateWhere = renderSql(mockUpdateWhere.mock.calls[0][0])
      expect(updateWhere.sql).toContain('"messages"."chat_id" = $2')
      expect(updateWhere.params).toEqual([messageId, chatId])
    })

    it("should report notFound and write nothing for another user's message", async () => {
      // The owner-scoped read matches no row for a foreign message.
      const mockLimit = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = mockJoinedFrom(mockWhere)
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })
      vi.mocked(db).update = vi.fn().mockReturnValue({})

      const result = await updateMessageFeedback(
        'victim-message',
        1,
        'attacker'
      )

      expect(result).toEqual({
        success: false,
        error: 'Message not found',
        notFound: true
      })
      expect(renderSql(mockWhere.mock.calls[0][0]).params).toEqual([
        'victim-message',
        'attacker'
      ])
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should fail when the update affects no rows', async () => {
      const messageId = 'test-message-id'

      const mockLimit = vi
        .fn()
        .mockResolvedValue([{ metadata: null, chatId: 'test-chat-id' }])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = mockJoinedFrom(mockWhere)
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const mockReturning = vi.fn().mockResolvedValue([])
      const mockUpdateWhere = vi
        .fn()
        .mockReturnValue({ returning: mockReturning })
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
      vi.mocked(db).update = vi.fn().mockReturnValue({ set: mockSet })

      const result = await updateMessageFeedback(messageId, 1, userId)

      expect(result).toEqual({
        success: false,
        error: 'Feedback update affected no rows',
        notFound: true
      })
    })

    it('should return error when message not found', async () => {
      const messageId = 'non-existent-id'
      const score = 1

      // Mock empty database response
      const mockLimit = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = mockJoinedFrom(mockWhere)
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await updateMessageFeedback(messageId, score, userId)

      expect(result).toEqual({
        success: false,
        error: 'Message not found',
        notFound: true
      })
    })

    it('should handle errors gracefully', async () => {
      const messageId = 'test-message-id'
      const score = -1

      // Mock database error
      const mockLimit = vi.fn().mockRejectedValue(new Error('Database error'))
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = mockJoinedFrom(mockWhere)
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await updateMessageFeedback(messageId, score, userId)

      expect(result.success).toBe(false)
      if (result.success) {
        throw new Error('expected feedback update to fail')
      }
      expect(result.error).toBe('Database error')
    })
  })
})
