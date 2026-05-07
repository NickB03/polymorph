import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  canvasArtifacts,
  canvasArtifactVersions,
  chats,
  messages
} from '@/lib/db/schema'
import type { StreamContext } from '@/lib/streaming/helpers/types'

type Row = Record<string, any>

type MemoryStore = {
  chats: Row[]
  messages: Row[]
  canvasArtifacts: Row[]
  canvasArtifactVersions: Row[]
}

type Gate = {
  chatId: string
  userId: string
  promise: Promise<void>
  release: () => void
}

const dialect = new PgDialect()

function deferred() {
  let release!: () => void
  const promise = new Promise<void>(resolve => {
    release = resolve
  })

  return { promise, release }
}

function clone<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T
  }

  if (Array.isArray(value)) {
    return value.map(item => clone(item)) as T
  }

  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) } as T
  }

  return value
}

function parseSql(expression: unknown) {
  return dialect.sqlToQuery(expression as any)
}

function normalizeValue(value: unknown) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).getTime()
  }

  if (value instanceof Date) {
    return value.getTime()
  }

  return value
}

function tableRows(store: MemoryStore, table: unknown) {
  const tableName = tableNameOf(table)

  if (tableName === 'chats') return store.chats
  if (tableName === 'messages') return store.messages
  if (tableName === 'canvas_artifacts') return store.canvasArtifacts
  if (tableName === 'canvas_artifact_versions') {
    return store.canvasArtifactVersions
  }
  throw new Error('Unsupported table in test DB')
}

function tableNameOf(table: unknown) {
  const nameSymbol = Object.getOwnPropertySymbols(table as object).find(
    symbol => symbol.description === 'drizzle:Name'
  )
  const tableName = nameSymbol
    ? (table as Record<symbol, string>)[nameSymbol]
    : undefined

  if (!tableName) {
    throw new Error('Unsupported table reference in test DB')
  }

  return tableName
}

function columnProperty(tableName: string, columnName: string) {
  const key = `${tableName}.${columnName}`

  const lookup: Record<string, string> = {
    'chats.id': 'id',
    'chats.created_at': 'createdAt',
    'chats.title': 'title',
    'chats.user_id': 'userId',
    'chats.visibility': 'visibility',
    'messages.id': 'id',
    'messages.chat_id': 'chatId',
    'messages.role': 'role',
    'messages.created_at': 'createdAt',
    'messages.updated_at': 'updatedAt',
    'messages.metadata': 'metadata',
    'canvas_artifacts.id': 'id',
    'canvas_artifacts.chat_id': 'chatId',
    'canvas_artifacts.user_id': 'userId',
    'canvas_artifacts.title': 'title',
    'canvas_artifacts.status': 'status',
    'canvas_artifacts.draft_source': 'draftSource',
    'canvas_artifacts.draft_compiled_html': 'draftCompiledHtml',
    'canvas_artifacts.draft_diagnostics': 'draftDiagnostics',
    'canvas_artifacts.draft_revision': 'draftRevision',
    'canvas_artifacts.current_version_id': 'currentVersionId',
    'canvas_artifacts.last_compiled_at': 'lastCompiledAt',
    'canvas_artifacts.created_at': 'createdAt',
    'canvas_artifacts.updated_at': 'updatedAt',
    'canvas_artifact_versions.id': 'id',
    'canvas_artifact_versions.artifact_id': 'artifactId',
    'canvas_artifact_versions.version_number': 'versionNumber',
    'canvas_artifact_versions.source_snapshot': 'sourceSnapshot',
    'canvas_artifact_versions.created_by': 'createdBy',
    'canvas_artifact_versions.created_at': 'createdAt'
  }

  const property = lookup[key]
  if (!property) {
    throw new Error(`Unsupported column mapping: ${key}`)
  }

  return property
}

function splitTopLevelAnd(sql: string) {
  return sql
    .split(' and ')
    .map(part => part.trim().replace(/^\(+/, '').replace(/\)+$/, ''))
    .filter(Boolean)
}

function canReadRow(
  store: MemoryStore,
  row: Row,
  table: unknown,
  userId?: string
): boolean {
  if (!userId) return true

  const tableName = tableNameOf(table)

  if (tableName === 'chats') {
    return row.userId === userId || row.visibility === 'public'
  }

  if (tableName === 'messages') {
    const chat = store.chats.find(candidate => candidate.id === row.chatId)
    return !!chat && canReadRow(store, chat, chats, userId)
  }

  if (tableName === 'canvas_artifacts') {
    return row.userId === userId
  }

  if (tableName === 'canvas_artifact_versions') {
    const artifact = store.canvasArtifacts.find(
      candidate => candidate.id === row.artifactId
    )
    return !!artifact && canReadRow(store, artifact, canvasArtifacts, userId)
  }

  return true
}

function assertWriteAccess(
  store: MemoryStore,
  table: unknown,
  row: Row,
  userId?: string
) {
  if (!userId) return

  const tableName = tableNameOf(table)

  if (tableName === 'chats') {
    if (row.userId !== userId) {
      throw new Error('new row violates row-level security policy')
    }
    return
  }

  if (tableName === 'messages') {
    const chat = store.chats.find(candidate => candidate.id === row.chatId)
    if (!chat || chat.userId !== userId) {
      throw new Error('new row violates row-level security policy')
    }
    return
  }

  if (tableName === 'canvas_artifacts') {
    const chat = store.chats.find(candidate => candidate.id === row.chatId)
    if (!chat) {
      throw new Error(
        'insert or update on table "canvas_artifacts" violates foreign key constraint'
      )
    }
    if (row.userId !== userId || chat.userId !== userId) {
      throw new Error('new row violates row-level security policy')
    }
    return
  }

  if (tableName === 'canvas_artifact_versions') {
    const artifact = store.canvasArtifacts.find(
      candidate => candidate.id === row.artifactId
    )
    if (!artifact || artifact.userId !== userId) {
      throw new Error('new row violates row-level security policy')
    }
  }
}

function matchesWhere(
  store: MemoryStore,
  row: Row,
  table: unknown,
  where: unknown
): boolean {
  if (!where) return true

  const rendered = parseSql(where)
  return matchesRenderedWhere(
    store,
    row,
    table,
    rendered.sql.trim(),
    rendered.params
  )
}

function matchesRenderedWhere(
  store: MemoryStore,
  row: Row,
  table: unknown,
  sql: string,
  params: unknown[]
): boolean {
  const normalizedSql =
    sql.startsWith('(') && sql.endsWith(')') ? sql.slice(1, -1) : sql

  if (normalizedSql.includes(' and ')) {
    return splitTopLevelAnd(`(${normalizedSql})`).every(clause =>
      matchesRenderedWhere(store, row, table, clause, params)
    )
  }

  const equality = normalizedSql.match(/^"([^"]+)"\."([^"]+)" = \$(\d+)$/)
  if (equality) {
    const [, tableName, columnName, paramIndex] = equality
    const property = columnProperty(tableName, columnName)
    return (
      normalizeValue(row[property]) ===
      normalizeValue(params[Number(paramIndex) - 1])
    )
  }

  const greaterThan = normalizedSql.match(/^"([^"]+)"\."([^"]+)" > \$(\d+)$/)
  if (greaterThan) {
    const [, tableName, columnName, paramIndex] = greaterThan
    const property = columnProperty(tableName, columnName)
    const rowValue = normalizeValue(row[property]) as string | number
    const paramValue = normalizeValue(params[Number(paramIndex) - 1]) as
      | string
      | number
    return rowValue > paramValue
  }

  const inArray = normalizedSql.match(/^"([^"]+)"\."([^"]+)" in \((.+)\)$/)
  if (inArray) {
    const [, tableName, columnName] = inArray
    const property = columnProperty(tableName, columnName)
    return params.map(normalizeValue).includes(normalizeValue(row[property]))
  }

  throw new Error(
    `Unsupported rendered where clause in test DB: ${normalizedSql}`
  )
}

function applyOrdering(rows: Row[], orderings: unknown[]) {
  if (orderings.length === 0) return rows

  return [...rows].sort((left, right) => {
    for (const ordering of orderings) {
      const rendered = parseSql(ordering)
      const match = rendered.sql.match(/^"([^"]+)"\."([^"]+)" (asc|desc)$/)
      if (!match) {
        throw new Error(`Unsupported order by in test DB: ${rendered.sql}`)
      }

      const [, tableName, columnName, direction] = match
      const property = columnProperty(tableName, columnName)
      const leftValue = normalizeValue(left[property]) as string | number
      const rightValue = normalizeValue(right[property]) as string | number

      if (leftValue === rightValue) {
        continue
      }

      const multiplier = direction === 'asc' ? 1 : -1
      return leftValue > rightValue ? multiplier : -multiplier
    }

    return 0
  })
}

function projectRow(row: Row, selectedFields: Record<string, any> | undefined) {
  if (!selectedFields) {
    return clone(row)
  }

  return Object.fromEntries(
    Object.entries(selectedFields).map(([alias, column]) => {
      const field = column as { table: unknown; name: string }
      const tableName = tableNameOf(field.table)

      return [alias, row[columnProperty(tableName, field.name)]]
    })
  )
}

class SelectBuilder {
  private currentTable: unknown
  private whereClause: unknown
  private orderings: unknown[] = []

  constructor(
    private store: MemoryStore,
    private selectedFields: Record<string, any> | undefined,
    private currentUserId?: string
  ) {}

  from(table: unknown) {
    this.currentTable = table
    return this
  }

  where(where: unknown) {
    this.whereClause = where
    return this
  }

  orderBy(...orderings: unknown[]) {
    this.orderings = orderings.flat()
    return this
  }

  async limit(limit: number) {
    return (await this.execute()).slice(0, limit)
  }

  async then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<Row[]> {
    const rows = tableRows(this.store, this.currentTable)
      .filter(row =>
        canReadRow(this.store, row, this.currentTable, this.currentUserId)
      )
      .filter(row =>
        matchesWhere(this.store, row, this.currentTable, this.whereClause)
      )

    return applyOrdering(rows, this.orderings).map(row =>
      projectRow(row, this.selectedFields)
    )
  }
}

class InsertBuilder {
  private payloads: Row[] = []
  private conflictMode: 'none' | 'ignore' | 'update' = 'none'
  private updateSet: Row = {}

  constructor(
    private store: MemoryStore,
    private table: unknown,
    private currentUserId?: string,
    private gate?: Gate | null
  ) {}

  values(payload: Row | Row[]) {
    this.payloads = Array.isArray(payload)
      ? payload.map(item => clone(item) as Row)
      : [clone(payload) as Row]
    return this
  }

  onConflictDoNothing() {
    this.conflictMode = 'ignore'
    return this.execute(false)
  }

  onConflictDoUpdate(input: { set: Row }) {
    this.conflictMode = 'update'
    this.updateSet = input.set
    return this
  }

  async returning() {
    return this.execute(true)
  }

  private async execute(returnRows: boolean) {
    const rows = tableRows(this.store, this.table)
    const inserted: Row[] = []

    for (const payload of this.payloads) {
      const row: Row = {
        createdAt: payload.createdAt ?? new Date(),
        updatedAt: payload.updatedAt ?? null,
        ...payload
      }

      if (
        this.gate &&
        tableNameOf(this.table) === 'chats' &&
        row.id === this.gate.chatId &&
        row.userId === this.gate.userId &&
        this.currentUserId === this.gate.userId
      ) {
        await this.gate.promise
      }

      const duplicate = rows.find(existing => {
        const tableName = tableNameOf(this.table)

        if (tableName === 'chats' || tableName === 'messages') {
          return existing.id === row.id
        }

        if (tableName === 'canvas_artifacts') {
          return existing.chatId === row.chatId
        }

        if (tableName === 'canvas_artifact_versions') {
          return (
            existing.artifactId === row.artifactId &&
            existing.versionNumber === row.versionNumber
          )
        }

        return false
      })

      if (duplicate) {
        if (this.conflictMode === 'ignore') {
          continue
        }

        if (this.conflictMode === 'update') {
          Object.assign(duplicate, this.updateSet)
          inserted.push(clone(duplicate))
          continue
        }

        throw new Error('duplicate key value violates unique constraint')
      }

      assertWriteAccess(this.store, this.table, row, this.currentUserId)
      rows.push(row)
      inserted.push(clone(row))
    }

    return returnRows ? inserted : undefined
  }
}

class UpdateBuilder {
  private patch: Row = {}
  private whereClause: unknown

  constructor(
    private store: MemoryStore,
    private table: unknown,
    private currentUserId?: string
  ) {}

  set(patch: Row) {
    this.patch = patch
    return this
  }

  where(where: unknown) {
    this.whereClause = where
    return this
  }

  async returning() {
    const rows = tableRows(this.store, this.table)
      .filter(row =>
        canReadRow(this.store, row, this.table, this.currentUserId)
      )
      .filter(row =>
        matchesWhere(this.store, row, this.table, this.whereClause)
      )

    for (const row of rows) {
      const nextRow = { ...row, ...this.patch }
      assertWriteAccess(this.store, this.table, nextRow, this.currentUserId)
      Object.assign(row, nextRow)
    }

    return rows.map(clone)
  }
}

class DeleteBuilder {
  private whereClause: unknown

  constructor(
    private store: MemoryStore,
    private table: unknown,
    private currentUserId?: string
  ) {}

  where(where: unknown) {
    this.whereClause = where
    return this.execute()
  }

  private async execute() {
    const rows = tableRows(this.store, this.table)
    const toDelete = rows.filter(row =>
      canReadRow(this.store, row, this.table, this.currentUserId)
    )
    const ids = new Set(
      toDelete
        .filter(row =>
          matchesWhere(this.store, row, this.table, this.whereClause)
        )
        .map(row => row.id)
    )

    if (ids.size === 0) {
      return { rowCount: 0 }
    }

    for (let index = rows.length - 1; index >= 0; index--) {
      if (ids.has(rows[index].id)) {
        rows.splice(index, 1)
      }
    }

    return { rowCount: ids.size }
  }
}

function createMemoryDb(gate?: Gate | null) {
  const store: MemoryStore = {
    chats: [],
    messages: [],
    canvasArtifacts: [],
    canvasArtifactVersions: []
  }

  const createTx = () => {
    let currentUserId: string | undefined

    return {
      execute: async (query: unknown) => {
        const rendered = parseSql(query)
        if (
          rendered.sql === `SELECT set_config('app.current_user_id', $1, true)`
        ) {
          currentUserId = String(rendered.params[0])
          return []
        }

        throw new Error(`Unsupported SQL execution in test DB: ${rendered.sql}`)
      },
      insert: (table: unknown) =>
        new InsertBuilder(store, table, currentUserId, gate),
      select: (fields?: Record<string, any>) =>
        new SelectBuilder(store, fields, currentUserId),
      update: (table: unknown) =>
        new UpdateBuilder(store, table, currentUserId),
      delete: (table: unknown) =>
        new DeleteBuilder(store, table, currentUserId),
      query: {
        messages: {
          findMany: async (input: { where?: unknown; orderBy?: unknown[] }) => {
            const messageRows = applyOrdering(
              store.messages
                .filter(row => canReadRow(store, row, messages, currentUserId))
                .filter(row => matchesWhere(store, row, messages, input.where)),
              input.orderBy ?? []
            )

            return messageRows.map(messageRow => clone(messageRow))
          }
        }
      }
    }
  }

  const rootTx = createTx()

  return {
    store,
    db: {
      execute: rootTx.execute,
      insert: rootTx.insert,
      select: rootTx.select,
      update: rootTx.update,
      delete: rootTx.delete,
      query: rootTx.query,
      transaction: async (
        callback: (tx: ReturnType<typeof createTx>) => Promise<any>
      ) => callback(createTx())
    }
  }
}

describe('authenticated new chat canvas ownership race', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unmock('@/lib/db')
    vi.unmock('next/cache')
    vi.unmock('@/lib/canvas/compiler/compile-canvas-artifact')
    vi.unmock('@/lib/canvas/validation/validate-canvas-source')
  })

  it('keeps the chat and canvas readable by the authenticated owner when canvas creation wins the new-chat race', async () => {
    const chatId = 'chat-auth-race'
    const userId = 'user-auth-1'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const releaseGate = deferred()
    const gate: Gate = {
      chatId,
      userId,
      promise: releaseGate.promise,
      release: releaseGate.release
    }
    const memoryDb = createMemoryDb(gate)

    vi.doMock('next/cache', () => ({
      revalidateTag: vi.fn(),
      unstable_cache: (callback: (...args: any[]) => any) => callback
    }))

    vi.doMock('@/lib/db', () => ({
      db: memoryDb.db
    }))

    vi.doMock('@/lib/canvas/compiler/compile-canvas-artifact', () => ({
      compileCanvasArtifact: vi.fn(async ({ artifactId, revisionId }: any) => ({
        ok: true,
        html: `<html data-artifact-id="${artifactId}" data-revision="${revisionId}"></html>`,
        diagnostics: [],
        externalDependencies: []
      }))
    }))

    vi.doMock('@/lib/canvas/validation/validate-canvas-source', () => ({
      validateCanvasSource: vi.fn(() => ({
        ok: true,
        files: ['App.tsx'],
        diagnostics: [],
        externalDependencies: []
      }))
    }))

    const { prepareMessages } =
      await import('@/lib/streaming/helpers/prepare-messages')
    const { persistStreamResults } =
      await import('@/lib/streaming/helpers/persist-stream-results')
    const { createCanvasArtifactFromSource } =
      await import('@/lib/canvas/service')
    const { loadCanvasArtifactByChatId, loadChatWithMessages } =
      await import('@/lib/db/actions')

    const userMessage = {
      id: 'msg-user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Build a canvas app' }]
    } as any

    const assistantMessage = {
      id: 'msg-assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Here is the canvas artifact.' }]
    } as any

    const streamContext: StreamContext = {
      chatId,
      userId,
      modelId: 'test-model',
      trigger: 'submit-message' as const,
      initialChat: null,
      isNewChat: true
    }

    const preparedMessages = await prepareMessages(streamContext, [userMessage])

    expect(preparedMessages).toEqual([userMessage])
    expect(streamContext.pendingInitialSave).toBeDefined()
    expect(streamContext.pendingInitialUserMessage).toEqual(userMessage)

    const canvasResult = await createCanvasArtifactFromSource({
      chatId,
      userId,
      title: 'Race-safe canvas',
      draftSource: {
        'App.tsx':
          'export default function App() { return <main>Canvas</main> }'
      }
    })

    expect(canvasResult.ok).toBe(true)

    const persistPromise = persistStreamResults(
      assistantMessage,
      chatId,
      userId,
      undefined,
      undefined,
      undefined,
      undefined,
      streamContext.pendingInitialSave,
      streamContext.pendingInitialUserMessage
    )

    gate.release()
    await persistPromise

    const chat = await loadChatWithMessages(chatId, userId)
    const artifact = await loadCanvasArtifactByChatId(chatId, userId)

    expect(chat).not.toBeNull()
    expect(chat?.userId).toBe(userId)
    expect(chat?.messages.map(message => message.id)).toEqual([
      userMessage.id,
      assistantMessage.id
    ])
    expect(chat?.messages.map(message => message.role)).toEqual([
      'user',
      'assistant'
    ])

    expect(artifact).not.toBeNull()
    expect(artifact?.userId).toBe(userId)
    expect(artifact?.chatId).toBe(chatId)

    expect(
      memoryDb.store.chats.find(candidate => candidate.id === chatId)?.userId
    ).toBe(userId)
  })
})
