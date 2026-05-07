import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

const dbMocks = vi.hoisted(() => {
  const tx = {
    delete: vi.fn(),
    insert: vi.fn(),
    query: {
      messages: {
        findMany: vi.fn()
      }
    },
    select: vi.fn()
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
  loadChatWithMessages,
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

describe('canonical chat UIMessage loading', () => {
  beforeEach(() => {
    dbMocks.tx.delete.mockReset()
    dbMocks.tx.insert.mockReset()
    dbMocks.tx.query.messages.findMany.mockReset()
    dbMocks.tx.select.mockReset()
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
