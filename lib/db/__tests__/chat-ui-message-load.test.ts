import { PgDialect } from 'drizzle-orm/pg-core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

const dbMocks = vi.hoisted(() => {
  const tx = {
    delete: vi.fn(),
    execute: vi.fn(),
    insert: vi.fn(),
    query: {
      messages: {
        findMany: vi.fn()
      }
    },
    select: vi.fn(),
    update: vi.fn()
  }

  return { tx }
})

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn(async (callback: (tx: typeof dbMocks.tx) => unknown) =>
      callback(dbMocks.tx)
    )
  }
}))

vi.mock('@/lib/db/with-rls', () => ({
  withOptionalRLS: vi.fn(
    async (
      _userId: string | null,
      callback: (tx: typeof dbMocks.tx) => unknown
    ) => callback(dbMocks.tx)
  ),
  withRLS: vi.fn(
    async (_userId: string, callback: (tx: typeof dbMocks.tx) => unknown) =>
      callback(dbMocks.tx)
  )
}))

import {
  createChatWithFirstMessageTransaction,
  deleteMessagesAfter,
  deleteMessagesFromIndex,
  loadChatWithMessages,
  updateChatTitle,
  upsertMessage
} from '@/lib/db/actions'
import { buildUIMessageFromDB } from '@/lib/utils/message-mapping'

function mockChatSelect(chatRows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(chatRows)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))

  dbMocks.tx.select.mockReturnValueOnce({ from })

  return { from, limit, where }
}

function renderSql(expression: unknown) {
  return new PgDialect().sqlToQuery(expression as never)
}

describe('canonical chat UIMessage loading', () => {
  beforeEach(() => {
    dbMocks.tx.delete.mockReset()
    dbMocks.tx.insert.mockReset()
    dbMocks.tx.query.messages.findMany.mockReset()
    dbMocks.tx.select.mockReset()
    dbMocks.tx.update.mockReset()
  })

  it('buildUIMessageFromDB returns the uiMessage parts', () => {
    const rebuilt = buildUIMessageFromDB({
      id: 'msg-1',
      role: 'assistant',
      uiMessage: {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'canonical payload' }]
      }
    })

    expect(rebuilt.parts).toEqual([{ type: 'text', text: 'canonical payload' }])
  })

  it('buildUIMessageFromDB throws when uiMessage is null', () => {
    expect(() =>
      buildUIMessageFromDB({
        id: 'msg-1',
        role: 'assistant',
        uiMessage: null
      })
    ).toThrow('Invariant: message msg-1 has no uiMessage')
  })

  it('active schema and migration enforce uiMessage as non-null', () => {
    const schemaSource = readFileSync(
      join(process.cwd(), 'lib/db/schema.ts'),
      'utf8'
    )
    const migrationSource = readFileSync(
      join(process.cwd(), 'drizzle/0026_enforce_chat_ui_message.sql'),
      'utf8'
    )

    expect(schemaSource).toMatch(/uiMessage:\s*jsonb\('ui_message'\)/)
    expect(schemaSource).toMatch(/uiMessage:[\s\S]*\$type<UIMessage>\(\)/)
    expect(schemaSource).toMatch(/uiMessage:[\s\S]*\.notNull\(\)/)
    expect(migrationSource).toContain(
      'UPDATE "messages"\nSET "ui_message" = jsonb_strip_nulls'
    )
    expect(migrationSource).toContain("'parts', '[]'::jsonb")
    expect(migrationSource.indexOf('UPDATE "messages"')).toBeLessThan(
      migrationSource.indexOf(
        'ALTER TABLE "messages" ALTER COLUMN "ui_message" SET NOT NULL'
      )
    )
    expect(migrationSource).toContain(
      'IF EXISTS (SELECT 1 FROM "messages" WHERE "ui_message" IS NULL)'
    )
    expect(migrationSource).toContain(
      'ALTER TABLE "messages" ALTER COLUMN "ui_message" SET NOT NULL'
    )
  })

  it('loadChatWithMessages returns canonical row parts', async () => {
    mockChatSelect([
      {
        id: 'chat-1',
        title: 'Canonical chat',
        userId: 'user-1',
        visibility: 'private'
      }
    ])
    dbMocks.tx.query.messages.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date('2026-04-24T12:00:00.000Z'),
        metadata: null,
        uiMessage: {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'canonical payload' }]
        }
      }
    ])

    const chat = await loadChatWithMessages('chat-1', 'user-1')

    expect(chat?.messages[0]?.parts).toEqual([
      { type: 'text', text: 'canonical payload' }
    ])
  })

  it('loadChatWithMessages preserves manifest tool ui parts from canonical rows', async () => {
    const parts = [
      {
        type: 'tool-displayAgentArtifact',
        toolCallId: 'artifact-call-1',
        state: 'output-available',
        input: {
          id: 'artifact-1',
          title: 'API Schema',
          artifactType: 'code',
          content: 'export const schema = {}'
        },
        output: {
          id: 'artifact-1',
          title: 'API Schema',
          artifactType: 'code',
          content: 'export const schema = {}'
        }
      },
      {
        type: 'tool-displayQuestionWizard',
        toolCallId: 'wizard-call-1',
        state: 'output-available',
        input: {
          id: 'project-settings',
          steps: [
            {
              id: 'style',
              title: 'Style',
              options: [{ id: 'minimal', label: 'Minimal' }]
            },
            {
              id: 'tone',
              title: 'Tone',
              options: [{ id: 'friendly', label: 'Friendly' }]
            }
          ]
        },
        output: { style: 'minimal', tone: 'friendly' }
      }
    ]

    mockChatSelect([
      {
        id: 'chat-1',
        title: 'Canonical chat',
        userId: 'user-1',
        visibility: 'private'
      }
    ])
    dbMocks.tx.query.messages.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date('2026-04-24T12:00:00.000Z'),
        metadata: null,
        uiMessage: {
          id: 'msg-1',
          role: 'assistant',
          parts
        }
      }
    ])

    const chat = await loadChatWithMessages('chat-1', 'user-1')

    expect(chat?.messages[0]?.parts).toEqual(parts)
    expect(chat?.messages[0]?.parts[0]).toMatchObject({
      toolCallId: 'artifact-call-1',
      state: 'output-available',
      input: expect.objectContaining({ title: 'API Schema' }),
      output: expect.objectContaining({ artifactType: 'code' })
    })
    expect(chat?.messages[0]?.parts[1]).toMatchObject({
      toolCallId: 'wizard-call-1',
      state: 'output-available',
      input: expect.objectContaining({ id: 'project-settings' }),
      output: { style: 'minimal', tone: 'friendly' }
    })
  })

  it('loadChatWithMessages does not query compatibility parts when every row has uiMessage', async () => {
    mockChatSelect([
      {
        id: 'chat-1',
        title: 'Canonical chat',
        userId: 'user-1',
        visibility: 'private'
      }
    ])
    dbMocks.tx.query.messages.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date('2026-04-24T12:00:00.000Z'),
        metadata: null,
        uiMessage: {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'canonical payload' }]
        }
      }
    ])

    const chat = await loadChatWithMessages('chat-1', 'user-1')

    expect(chat?.messages[0]?.parts).toEqual([
      { type: 'text', text: 'canonical payload' }
    ])
    expect(dbMocks.tx.select).toHaveBeenCalledTimes(1)
    expect(dbMocks.tx.query.messages.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        with: expect.anything()
      })
    )
  })

  it('loadChatWithMessages merges uiMessage metadata, row metadata, and createdAt', async () => {
    const createdAt = new Date('2026-04-24T12:00:00.000Z')

    mockChatSelect([
      {
        id: 'chat-1',
        title: 'Canonical chat',
        userId: 'user-1',
        visibility: 'private'
      }
    ])
    dbMocks.tx.query.messages.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        createdAt,
        metadata: { traceId: 'trace-1' },
        uiMessage: {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'canonical payload' }],
          metadata: { modelId: 'gateway:test-model' }
        }
      }
    ])

    const chat = await loadChatWithMessages('chat-1', 'user-1')

    expect(chat?.messages[0]?.metadata).toEqual({
      modelId: 'gateway:test-model',
      traceId: 'trace-1',
      createdAt
    })
  })

  it('upsertMessage updates canonical uiMessage without touching parts table', async () => {
    const message: UIMessage & { chatId: string } = {
      id: 'msg-1',
      chatId: 'chat-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'updated canonical payload' }],
      metadata: { traceId: 'trace-updated' }
    }
    const messageInsert = {
      values: vi.fn(() => messageInsert),
      onConflictDoUpdate: vi.fn(() => messageInsert),
      returning: vi.fn().mockResolvedValue([{ id: 'msg-1' }])
    }

    mockChatSelect([{ userId: 'user-1' }])
    dbMocks.tx.insert.mockReturnValueOnce(messageInsert)

    await upsertMessage(message, 'user-1')

    expect(dbMocks.tx.insert).toHaveBeenCalledTimes(1)
    expect(dbMocks.tx.delete).toHaveBeenCalledTimes(0)
    expect(messageInsert.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          role: 'assistant',
          uiMessage: expect.objectContaining({
            parts: [{ type: 'text', text: 'updated canonical payload' }]
          }),
          metadata: { traceId: 'trace-updated' }
        })
      })
    )
  })

  describe('upsertMessage stale guard (aborted partials)', () => {
    const partial: UIMessage & { chatId: string } = {
      id: 'partial-1',
      chatId: 'chat-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'partial' }]
    }
    const since = new Date('2026-01-01T00:00:10Z')

    function mockLatest(rows: unknown[]) {
      const limit = vi.fn().mockResolvedValue(rows)
      const orderBy = vi.fn(() => ({ limit }))
      const where = vi.fn(() => ({ orderBy }))
      dbMocks.tx.select.mockReturnValueOnce({ from: vi.fn(() => ({ where })) })
    }

    function mockInsert() {
      const insert = {
        values: vi.fn(() => insert),
        onConflictDoUpdate: vi.fn(() => insert),
        returning: vi.fn().mockResolvedValue([{ id: 'partial-1' }])
      }
      dbMocks.tx.insert.mockReturnValueOnce(insert)
    }

    it('persists when the answered message is still the latest', async () => {
      mockChatSelect([{ userId: 'user-1' }])
      mockLatest([{ id: 'user-1', updatedAt: null }])
      mockInsert()

      await expect(
        upsertMessage(partial, 'user-1', { latestId: 'user-1', since })
      ).resolves.toEqual({ id: 'partial-1' })
    })

    it('takes the per-chat lock before the stale read', async () => {
      dbMocks.tx.execute.mockClear()
      dbMocks.tx.select.mockClear()
      mockChatSelect([{ userId: 'user-1' }])
      mockLatest([{ id: 'user-1', updatedAt: null }])
      mockInsert()

      await upsertMessage(partial, 'user-1', { latestId: 'user-1', since })

      // A mock cannot prove mutual exclusion (the real-Postgres test does);
      // it can prove the lock is requested first, which is what makes the
      // read-then-insert atomic.
      expect(dbMocks.tx.execute).toHaveBeenCalledTimes(1)
      expect(dbMocks.tx.execute.mock.invocationCallOrder[0]).toBeLessThan(
        dbMocks.tx.select.mock.invocationCallOrder[0]
      )
    })

    it.each([
      ['a newer message exists', [{ id: 'user-2', updatedAt: null }]],
      ['the answered message was deleted', []],
      [
        'the answered message was edited since',
        [{ id: 'user-1', updatedAt: new Date('2026-01-01T00:00:20Z') }]
      ]
    ])('skips the write when %s', async (_name, rows) => {
      mockChatSelect([{ userId: 'user-1' }])
      mockLatest(rows)

      await expect(
        upsertMessage(partial, 'user-1', { latestId: 'user-1', since })
      ).resolves.toBeNull()
      expect(dbMocks.tx.insert).not.toHaveBeenCalled()
    })
  })

  // The app's DB role may bypass RLS, so every writer that takes a userId must
  // enforce chat ownership itself.
  describe('explicit chat ownership on message/chat writers', () => {
    const message: UIMessage & { chatId: string } = {
      id: 'msg-1',
      chatId: 'victim-chat',
      role: 'user',
      parts: [{ type: 'text', text: 'injected' }]
    }

    function mockMessageInsert(rows: unknown[]) {
      const insert = {
        values: vi.fn(() => insert),
        onConflictDoUpdate: vi.fn((_config: { setWhere?: unknown }) => insert),
        returning: vi.fn().mockResolvedValue(rows)
      }
      dbMocks.tx.insert.mockReturnValueOnce(insert)
      return insert
    }

    it.each([
      ['belongs to another user', [{ userId: 'victim' }]],
      ['does not exist', []]
    ])('upsertMessage refuses when the chat %s', async (_name, chatRows) => {
      mockChatSelect(chatRows)

      await expect(upsertMessage(message, 'attacker')).rejects.toThrow(
        'Unauthorized'
      )
      expect(dbMocks.tx.insert).not.toHaveBeenCalled()
    })

    it('upsertMessage only overwrites a conflicting id within the same chat', async () => {
      mockChatSelect([{ userId: 'attacker' }])
      const insert = mockMessageInsert([{ id: 'msg-1' }])

      await upsertMessage({ ...message, chatId: 'own-chat' }, 'attacker')

      const { setWhere } = insert.onConflictDoUpdate.mock.calls[0][0]
      const rendered = renderSql(setWhere)
      expect(rendered.sql).toBe('"messages"."chat_id" = $1')
      expect(rendered.params).toEqual(['own-chat'])
    })

    it('upsertMessage throws when the id belongs to a message in another chat', async () => {
      mockChatSelect([{ userId: 'attacker' }])
      // The conflict row failed setWhere, so nothing was written or returned.
      mockMessageInsert([])

      await expect(
        upsertMessage({ ...message, chatId: 'own-chat' }, 'attacker')
      ).rejects.toThrow('different chat')
    })

    it('deleteMessagesFromIndex refuses a chat owned by another user', async () => {
      mockChatSelect([{ userId: 'victim' }])

      await expect(
        deleteMessagesFromIndex('victim-chat', 'msg-1', 'attacker')
      ).rejects.toThrow('Unauthorized')
      expect(dbMocks.tx.delete).not.toHaveBeenCalled()
    })

    it('deleteMessagesAfter refuses a chat owned by another user', async () => {
      mockChatSelect([{ userId: 'victim' }])

      await expect(
        deleteMessagesAfter('victim-chat', 'msg-1', 'attacker')
      ).rejects.toThrow('Unauthorized')
      expect(dbMocks.tx.delete).not.toHaveBeenCalled()
    })

    it('updateChatTitle only matches a chat owned by the user', async () => {
      const returning = vi.fn().mockResolvedValue([])
      const where = vi.fn((_where: unknown) => ({ returning }))
      const set = vi.fn(() => ({ where }))
      dbMocks.tx.update.mockReturnValueOnce({ set })

      await expect(
        updateChatTitle('victim-chat', 'pwned', 'attacker')
      ).resolves.toBeNull()

      const rendered = renderSql(where.mock.calls[0][0])
      expect(rendered.sql).toContain('"chats"."id" = $1')
      expect(rendered.sql).toContain('"chats"."user_id" = $2')
      expect(rendered.params).toEqual(['victim-chat', 'attacker'])
    })
  })

  it('createChatWithFirstMessageTransaction persists first message without sidecar projections', async () => {
    const message: UIMessage = {
      id: 'msg-1',
      role: 'user',
      parts: [{ type: 'text', text: 'canonical first message' }],
      metadata: { userMode: 'search' }
    }
    const chatInsert = {
      values: vi.fn(() => chatInsert),
      returning: vi.fn().mockResolvedValue([{ id: 'chat-1' }])
    }
    const messageInsert = {
      values: vi.fn(() => messageInsert),
      returning: vi.fn().mockResolvedValue([{ id: 'msg-1' }])
    }

    dbMocks.tx.insert
      .mockReturnValueOnce(chatInsert)
      .mockReturnValueOnce(messageInsert)

    await createChatWithFirstMessageTransaction({
      chatId: 'chat-1',
      chatTitle: 'Canonical chat',
      userId: 'user-1',
      message
    })

    expect(dbMocks.tx.insert).toHaveBeenCalledTimes(2)
    expect(messageInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'msg-1',
        chatId: 'chat-1',
        uiMessage: expect.objectContaining({
          parts: [{ type: 'text', text: 'canonical first message' }]
        })
      })
    )
  })
})
