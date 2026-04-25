import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'
import type { DBMessagePartSelect } from '@/lib/types/message-persistence'

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

import { loadChatWithMessages, upsertMessage } from '@/lib/db/actions'
import { buildUIMessageFromDB } from '@/lib/utils/message-mapping'

function makeTextPart(
  overrides: Partial<DBMessagePartSelect> = {}
): DBMessagePartSelect {
  return {
    id: 'part-1',
    messageId: 'msg-1',
    order: 0,
    type: 'text',
    text_text: 'legacy payload',
    reasoning_text: null,
    file_mediaType: null,
    file_filename: null,
    file_url: null,
    source_url_sourceId: null,
    source_url_url: null,
    source_url_title: null,
    source_document_sourceId: null,
    source_document_mediaType: null,
    source_document_title: null,
    source_document_filename: null,
    source_document_url: null,
    source_document_snippet: null,
    tool_toolCallId: null,
    tool_state: null,
    tool_errorText: null,
    tool_search_input: null,
    tool_search_output: null,
    tool_fetch_input: null,
    tool_fetch_output: null,
    tool_question_input: null,
    tool_question_output: null,
    tool_todoWrite_input: null,
    tool_todoWrite_output: null,
    tool_todoRead_input: null,
    tool_todoRead_output: null,
    tool_dynamic_input: null,
    tool_dynamic_output: null,
    tool_dynamic_name: null,
    tool_dynamic_type: null,
    data_prefix: null,
    data_content: null,
    data_id: null,
    providerMetadata: null,
    createdAt: new Date('2026-04-24T12:00:00.000Z'),
    ...overrides
  } as DBMessagePartSelect
}

function mockChatSelect(chatRows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(chatRows)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))

  dbMocks.tx.select.mockReturnValueOnce({ from })

  return { from, limit, where }
}

function mockPartsSelect(partRows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(partRows)
  const where = vi.fn(() => ({ orderBy }))
  const from = vi.fn(() => ({ where }))

  dbMocks.tx.select.mockReturnValueOnce({ from })

  return { from, orderBy, where }
}

describe('canonical chat UIMessage loading', () => {
  beforeEach(() => {
    dbMocks.tx.delete.mockReset()
    dbMocks.tx.insert.mockReset()
    dbMocks.tx.query.messages.findMany.mockReset()
    dbMocks.tx.select.mockReset()
  })

  it('buildUIMessageFromDB prefers row uiMessage parts over legacy parts', () => {
    const rebuilt = buildUIMessageFromDB(
      {
        id: 'msg-1',
        role: 'assistant',
        uiMessage: {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'canonical payload' }]
        }
      },
      [makeTextPart({ text_text: 'legacy payload' })]
    )

    expect(rebuilt.parts).toEqual([{ type: 'text', text: 'canonical payload' }])
  })

  it('buildUIMessageFromDB reconstructs from legacy parts when uiMessage is null', () => {
    const rebuilt = buildUIMessageFromDB(
      {
        id: 'msg-1',
        role: 'assistant',
        uiMessage: null
      },
      [makeTextPart({ text_text: 'legacy payload' })]
    )

    expect(rebuilt.parts).toEqual([{ type: 'text', text: 'legacy payload' }])
  })

  it('loadChatWithMessages returns canonical row parts before compatibility parts', async () => {
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
        },
        parts: [makeTextPart({ text_text: 'legacy payload' })]
      }
    ])

    const chat = await loadChatWithMessages('chat-1', 'user-1')

    expect(chat?.messages[0]?.parts).toEqual([
      { type: 'text', text: 'canonical payload' }
    ])
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

  it('loadChatWithMessages queries compatibility parts only for legacy rows', async () => {
    mockChatSelect([
      {
        id: 'chat-1',
        title: 'Mixed chat',
        userId: 'user-1',
        visibility: 'private'
      }
    ])
    mockPartsSelect([
      makeTextPart({
        id: 'part-legacy',
        messageId: 'msg-legacy',
        text_text: 'legacy payload'
      })
    ])
    dbMocks.tx.query.messages.findMany.mockResolvedValue([
      {
        id: 'msg-canonical',
        role: 'assistant',
        createdAt: new Date('2026-04-24T12:00:00.000Z'),
        metadata: null,
        uiMessage: {
          id: 'msg-canonical',
          role: 'assistant',
          parts: [{ type: 'text', text: 'canonical payload' }]
        }
      },
      {
        id: 'msg-legacy',
        role: 'assistant',
        createdAt: new Date('2026-04-24T12:01:00.000Z'),
        metadata: null,
        uiMessage: null
      }
    ])

    const chat = await loadChatWithMessages('chat-1', 'user-1')

    expect(chat?.messages.map(message => message.parts)).toEqual([
      [{ type: 'text', text: 'canonical payload' }],
      [{ type: 'text', text: 'legacy payload' }]
    ])
    expect(dbMocks.tx.select).toHaveBeenCalledTimes(2)
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
        },
        parts: []
      }
    ])

    const chat = await loadChatWithMessages('chat-1', 'user-1')

    expect(chat?.messages[0]?.metadata).toEqual({
      modelId: 'gateway:test-model',
      traceId: 'trace-1',
      createdAt
    })
  })

  it('upsertMessage updates the canonical uiMessage payload on conflict', async () => {
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
    const deleteParts = {
      where: vi.fn().mockResolvedValue(undefined)
    }
    const partsInsert = {
      values: vi.fn().mockResolvedValue(undefined)
    }

    dbMocks.tx.insert
      .mockReturnValueOnce(messageInsert)
      .mockReturnValueOnce(partsInsert)
    dbMocks.tx.delete.mockReturnValueOnce(deleteParts)

    await upsertMessage(message, 'user-1')

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
})
