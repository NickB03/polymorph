'use server'

import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'

import type { UIMessage } from '@/lib/types/ai'
import type { PersistableUIMessage } from '@/lib/types/message-persistence'

// Legacy artifact types inlined here since the old types file was deleted.
// These are only used by the legacy DB functions below which are retained
// for Drizzle schema compatibility but are not called from active code.
type ArtifactStatus = 'building' | 'ready' | 'failed' | 'restarting' | 'expired'
type CreateArtifactInput = {
  id?: string
  chatId: string
  userId: string | null
  currentRevisionId?: string | null
  currentRuntimeSessionId?: string | null
  title: string
  framework: 'react-spa'
  status: ArtifactStatus
}
type AppendArtifactRevisionInput = {
  id?: string
  artifactId: string
  triggeringMessageId: string
  promptSummary: string
  title: string
  sandboxSnapshotRef?: string | null
  sourceFiles?: Record<string, string> | null
}
type UpsertArtifactRuntimeSessionInput = {
  id?: string
  artifactId: string
  provider: 'sandbox'
  sandboxId: string
  previewUrl?: string | null
  status: ArtifactStatus
  startedAt: Date
  expiresAt?: Date | null
  lastHeartbeatAt?: Date | null
}
import type {
  CanvasArtifactStatus,
  CanvasDiagnostics,
  CanvasSourceFiles,
  CanvasVersionCreatedBy
} from '@/lib/types/canvas'
import {
  buildUIMessageFromDB,
  mapUIMessageToDBMessage
} from '@/lib/utils/message-mapping'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { incrementDbOperationCount } from '@/lib/utils/perf-tracking'

import type { Chat, Message, Part } from './schema'
import {
  artifactRevisions,
  artifactRuntimeSessions,
  artifacts,
  canvasArtifacts,
  canvasArtifactVersions,
  chats,
  generateId,
  messages,
  parts
} from './schema'
import type { TxInstance } from './with-rls'
import { withOptionalRLS, withRLS } from './with-rls'
import { db } from '.'

type CompatibilityPartsReader = Pick<TxInstance, 'select'>

async function loadCompatibilityPartsByMessageId(
  tx: CompatibilityPartsReader,
  messageRows: Message[]
): Promise<Map<string, Part[]>> {
  const legacyMessageIds = messageRows
    .filter(message => !message.uiMessage)
    .map(message => message.id)

  if (legacyMessageIds.length === 0) {
    return new Map()
  }

  const compatibilityParts = await tx
    .select()
    .from(parts)
    .where(inArray(parts.messageId, legacyMessageIds))
    .orderBy(asc(parts.messageId), asc(parts.order))

  const partsByMessageId = new Map<string, Part[]>()
  for (const part of compatibilityParts) {
    const existing = partsByMessageId.get(part.messageId)
    if (existing) {
      existing.push(part)
    } else {
      partsByMessageId.set(part.messageId, [part])
    }
  }

  return partsByMessageId
}

function buildUIMessagesFromRows(
  messageRows: Message[],
  partsByMessageId: Map<string, Part[]>
): UIMessage[] {
  return messageRows.map(message =>
    buildUIMessageFromDB(message, partsByMessageId.get(message.id) ?? [])
  )
}

/**
 * Ensure a chat record exists for the given ID.
 *
 * Used by the artifact flow to satisfy the foreign key constraint
 * on artifacts.chat_id for guest/ephemeral sessions where no chat
 * row was previously created.
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING so it is safe to call
 * concurrently or repeatedly for the same chatId.
 */
export async function ensureChatRecord(input: {
  id: string
  title: string
  userId: string
  visibility?: 'public' | 'private'
}): Promise<void> {
  await db
    .insert(chats)
    .values({
      id: input.id,
      title: input.title,
      userId: input.userId,
      visibility: input.visibility ?? 'private'
    })
    .onConflictDoNothing({ target: chats.id })
}

/**
 * Create a new chat
 */
export async function createChat({
  id = generateId(),
  title,
  userId,
  visibility = 'private'
}: {
  id?: string
  title: string
  userId: string
  visibility?: 'public' | 'private'
}): Promise<Chat> {
  return withRLS(userId, async tx => {
    const [chat] = await tx
      .insert(chats)
      .values({
        id,
        title,
        userId,
        visibility
      })
      .returning()

    return chat
  })
}

/**
 * Get chat by ID with permission check
 */
export async function getChat(
  chatId: string,
  userId?: string
): Promise<Chat | null> {
  // For public chats or when no userId, use regular db connection
  // For private chats with userId, use RLS
  return withOptionalRLS(userId || null, async tx => {
    const [chat] = await tx
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1)

    if (!chat) {
      return null
    }

    // Additional permission check for backward compatibility
    if (chat.visibility === 'public') {
      return chat
    }

    if (chat.visibility === 'private' && userId && chat.userId === userId) {
      return chat
    }

    return null
  })
}

/**
 * Upsert a message with its parts
 * Note: This function should be called with appropriate userId context
 */
export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  userId?: string
): Promise<Message> {
  const count = incrementDbOperationCount()
  perfLog(`DB - upsertMessage called - count: ${count}`)

  // Use RLS if userId is provided, otherwise use regular db
  const executeFn = userId
    ? (callback: (tx: TxInstance) => Promise<Message>) =>
        withRLS(userId, callback)
    : (callback: (tx: TxInstance) => Promise<Message>) =>
        db.transaction(callback)

  const result = await executeFn(async tx => {
    // 1. Insert or update the message
    const messageData = mapUIMessageToDBMessage(message)
    const [dbMessage] = await tx
      .insert(messages)
      .values(messageData)
      .onConflictDoUpdate({
        target: messages.id,
        set: {
          role: messageData.role,
          uiMessage: messageData.uiMessage,
          metadata: messageData.metadata,
          updatedAt: new Date()
        }
      })
      .returning()

    // 2. Clear any stale legacy projection rows for this message. New writes
    // persist canonical UIMessage payloads only.
    await tx.delete(parts).where(eq(parts.messageId, message.id))

    return dbMessage
  })

  return result
}

/**
 * Load chat messages with parts
 * Note: Caller should verify chat access permissions before calling this
 */
export async function loadChat(
  chatId: string,
  userId?: string
): Promise<UIMessage[]> {
  return withOptionalRLS(userId || null, async tx => {
    const result = await tx.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      orderBy: [asc(messages.createdAt)]
    })
    const compatibilityPartsByMessageId =
      await loadCompatibilityPartsByMessageId(tx, result)

    return buildUIMessagesFromRows(result, compatibilityPartsByMessageId)
  })
}

/**
 * Load the most recent artifact for a chat
 */
export async function loadArtifactByChatId(
  chatId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [artifact] = await tx
      .select()
      .from(artifacts)
      .where(eq(artifacts.chatId, chatId))
      .orderBy(desc(artifacts.updatedAt))
      .limit(1)

    return artifact ?? null
  })
}

/**
 * Load an artifact by its ID.
 *
 * **Security:** When `userId` is `null`, RLS is bypassed and the query runs
 * without row-level permission checks. Callers MUST authenticate through an
 * alternative mechanism (e.g. a signed guest artifact token) before passing
 * `null`. Prefer passing a real `userId` whenever one is available.
 */
export async function loadArtifactById(
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [artifact] = await tx
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, artifactId))
      .limit(1)

    return artifact ?? null
  })
}

/**
 * Load the current runtime session for an artifact.
 *
 * **Security:** When `userId` is `null`, RLS is bypassed and the query runs
 * without row-level permission checks. Callers MUST authenticate through an
 * alternative mechanism (e.g. a signed guest artifact token) before passing
 * `null`. Prefer passing a real `userId` whenever one is available.
 */
export async function loadArtifactRuntimeSession(
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [session] = await tx
      .select()
      .from(artifactRuntimeSessions)
      .where(eq(artifactRuntimeSessions.artifactId, artifactId))
      .orderBy(desc(artifactRuntimeSessions.startedAt))
      .limit(1)

    return session ?? null
  })
}

/**
 * Create a persisted artifact record
 */
export async function createArtifactRecord(input: CreateArtifactInput) {
  return withOptionalRLS(input.userId, async tx => {
    const [artifact] = await tx
      .insert(artifacts)
      .values({
        id: input.id ?? generateId(),
        chatId: input.chatId,
        userId: input.userId,
        currentRevisionId: input.currentRevisionId ?? null,
        currentRuntimeSessionId: input.currentRuntimeSessionId ?? null,
        title: input.title,
        framework: input.framework,
        status: input.status,
        updatedAt: new Date()
      })
      .returning()

    return artifact
  })
}

export async function updateArtifactRecord(
  input: {
    id: string
    title?: string
    status?: ArtifactStatus
    currentRevisionId?: string | null
    currentRuntimeSessionId?: string | null
  },
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [artifact] = await tx
      .update(artifacts)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.currentRevisionId !== undefined
          ? { currentRevisionId: input.currentRevisionId }
          : {}),
        ...(input.currentRuntimeSessionId !== undefined
          ? { currentRuntimeSessionId: input.currentRuntimeSessionId }
          : {}),
        updatedAt: new Date()
      })
      .where(eq(artifacts.id, input.id))
      .returning()

    return artifact ?? null
  })
}

/**
 * Atomically claim an artifact for rebuild by transitioning its status
 * to 'building', but only if it is not already building.
 *
 * Returns the updated artifact if the claim succeeded, or null if
 * another rebuild is already in progress. This prevents concurrent
 * rebuild requests from creating duplicate sessions.
 */
export async function claimArtifactForRebuild(
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [artifact] = await tx
      .update(artifacts)
      .set({ status: 'building', updatedAt: new Date() })
      .where(
        and(
          eq(artifacts.id, artifactId),
          sql`${artifacts.status} != 'building'`
        )
      )
      .returning()

    return artifact ?? null
  })
}

/**
 * Append a revision and promote it to the current artifact revision
 */
export async function appendArtifactRevision(
  input: AppendArtifactRevisionInput,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    return tx.transaction(async nestedTx => {
      const [revision] = await nestedTx
        .insert(artifactRevisions)
        .values({
          id: input.id ?? generateId(),
          artifactId: input.artifactId,
          triggeringMessageId: input.triggeringMessageId,
          promptSummary: input.promptSummary,
          title: input.title,
          sandboxSnapshotRef: input.sandboxSnapshotRef ?? null,
          sourceFiles: input.sourceFiles ?? null
        })
        .returning()

      await nestedTx
        .update(artifacts)
        .set({
          currentRevisionId: revision.id,
          title: input.title,
          updatedAt: new Date()
        })
        .where(eq(artifacts.id, input.artifactId))

      return revision
    })
  })
}

/**
 * Load the latest revision for an artifact, including source files.
 * Used by rebuild-on-demand to reconstruct expired sandboxes,
 * and by orchestrateUpdate to merge partial file deltas.
 */
export async function loadLatestRevisionWithSource(
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [revision] = await tx
      .select()
      .from(artifactRevisions)
      .where(eq(artifactRevisions.artifactId, artifactId))
      .orderBy(desc(artifactRevisions.createdAt))
      .limit(1)
    return revision ?? null
  })
}

/**
 * Upsert a runtime session and promote it to the current runtime session
 */
export async function upsertArtifactRuntimeSession(
  input: UpsertArtifactRuntimeSessionInput,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    return tx.transaction(async nestedTx => {
      const [session] = await nestedTx
        .insert(artifactRuntimeSessions)
        .values({
          id: input.id ?? generateId(),
          artifactId: input.artifactId,
          provider: input.provider,
          sandboxId: input.sandboxId,
          previewUrl: input.previewUrl ?? null,
          status: input.status,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt ?? null,
          lastHeartbeatAt: input.lastHeartbeatAt ?? null
        })
        .onConflictDoUpdate({
          target: artifactRuntimeSessions.id,
          set: {
            sandboxId: input.sandboxId,
            previewUrl: input.previewUrl ?? null,
            status: input.status,
            startedAt: input.startedAt,
            expiresAt: input.expiresAt ?? null,
            lastHeartbeatAt: input.lastHeartbeatAt ?? null
          }
        })
        .returning()

      await nestedTx
        .update(artifacts)
        .set({
          currentRuntimeSessionId: session.id,
          status: input.status,
          updatedAt: new Date()
        })
        .where(eq(artifacts.id, input.artifactId))

      return session
    })
  })
}

/**
 * Load chat with messages in a single query (optimized)
 */
export async function loadChatWithMessages(
  chatId: string,
  userId?: string
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  const count = incrementDbOperationCount()
  perfLog(`DB - loadChatWithMessages called - count: ${count}`)

  return withOptionalRLS(userId || null, async tx => {
    // Get chat and messages in parallel
    const [chatResult, messagesResult] = await Promise.all([
      tx.select().from(chats).where(eq(chats.id, chatId)).limit(1),
      tx.query.messages.findMany({
        where: eq(messages.chatId, chatId),
        orderBy: [asc(messages.createdAt)]
      })
    ])

    const chat = chatResult[0]
    if (!chat) {
      return null
    }

    // Permission check for backward compatibility
    if (chat.visibility === 'private' && (!userId || chat.userId !== userId)) {
      return null
    }

    const compatibilityPartsByMessageId =
      await loadCompatibilityPartsByMessageId(tx, messagesResult)
    const uiMessages = buildUIMessagesFromRows(
      messagesResult,
      compatibilityPartsByMessageId
    )
    return { ...chat, messages: uiMessages }
  })
}

/**
 * Delete messages after a specific message
 */
export async function deleteMessagesAfter(
  chatId: string,
  messageId: string,
  userId?: string
): Promise<{ count: number }> {
  return withOptionalRLS(userId || null, async tx => {
    // Get the message's timestamp
    const [targetMessage] = await tx
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (!targetMessage) {
      return { count: 0 }
    }

    // Find messages to delete
    const messagesToDelete = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          gt(messages.createdAt, targetMessage.createdAt)
        )
      )

    const messageIds = messagesToDelete.map(m => m.id)

    if (messageIds.length > 0) {
      // Delete messages (parts will be cascade deleted)
      await tx.delete(messages).where(inArray(messages.id, messageIds))
    }

    return { count: messageIds.length }
  })
}

/**
 * Delete messages from a specific index
 */
export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string,
  userId?: string
): Promise<{ count: number }> {
  return withOptionalRLS(userId || null, async tx => {
    // Get all messages for the chat
    const allMessages = await tx
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt))

    // Find the index of the target message
    const messageIndex = allMessages.findIndex(m => m.id === messageId)

    if (messageIndex === -1) {
      return { count: 0 }
    }

    // Get messages to delete (from index onwards)
    const messagesToDelete = allMessages.slice(messageIndex)
    const messageIds = messagesToDelete.map(m => m.id)

    if (messageIds.length > 0) {
      await tx.delete(messages).where(inArray(messages.id, messageIds))
    }

    return { count: messageIds.length }
  })
}

/**
 * Get all chats for a user
 */
export async function getChats(userId: string): Promise<Chat[]> {
  return withRLS(userId, async tx => {
    return tx
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.createdAt))
  })
}

/**
 * Get chats with pagination
 */
export async function getChatsPage(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ chats: Chat[]; nextOffset: number | null }> {
  try {
    return withRLS(userId, async tx => {
      const results = await tx
        .select()
        .from(chats)
        .where(eq(chats.userId, userId))
        .orderBy(desc(chats.createdAt))
        .limit(limit)
        .offset(offset)

      const nextOffset = results.length === limit ? offset + limit : null

      return {
        chats: results,
        nextOffset
      }
    })
  } catch (error) {
    console.error('Error fetching chat page:', error)
    return { chats: [], nextOffset: null }
  }
}

/**
 * Delete a chat
 */
export async function deleteChat(
  chatId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return withRLS(userId, async tx => {
      // Verify ownership
      const [chat] = await tx
        .select()
        .from(chats)
        .where(eq(chats.id, chatId))
        .limit(1)

      if (!chat || chat.userId !== userId) {
        return { success: false, error: 'Unauthorized' }
      }

      // Delete the chat (messages and parts will cascade)
      await tx.delete(chats).where(eq(chats.id, chatId))

      return { success: true }
    })
  } catch (error) {
    console.error('Error deleting chat:', error)
    return { success: false, error: 'Failed to delete chat' }
  }
}

/**
 * Delete all chats for a user in a single transaction
 */
export async function clearAllChats(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return withRLS(userId, async tx => {
      await tx.delete(chats).where(eq(chats.userId, userId))
      return { success: true }
    })
  } catch (error) {
    console.error('Error clearing chats:', error)
    return { success: false, error: 'Failed to clear chats' }
  }
}

/**
 * Update chat visibility
 */
export async function updateChatVisibility(
  chatId: string,
  userId: string,
  visibility: 'public' | 'private'
): Promise<Chat | null> {
  return withRLS(userId, async tx => {
    const chat = await getChat(chatId, userId)
    if (!chat || chat.userId !== userId) {
      return null
    }

    const [updatedChat] = await tx
      .update(chats)
      .set({ visibility })
      .where(eq(chats.id, chatId))
      .returning()

    return updatedChat
  })
}

/**
 * Update chat title
 */
export async function updateChatTitle(
  chatId: string,
  title: string,
  userId?: string
): Promise<Chat | null> {
  return withOptionalRLS(userId || null, async tx => {
    const [updatedChat] = await tx
      .update(chats)
      .set({ title })
      .where(eq(chats.id, chatId))
      .returning()

    return updatedChat || null
  })
}

/**
 * Create a chat with the first message in a single transaction
 * Optimized for new chat creation
 */
export async function createChatWithFirstMessageTransaction({
  chatId,
  chatTitle,
  userId,
  message
}: {
  chatId: string
  chatTitle: string
  userId: string
  message: PersistableUIMessage
}): Promise<{ chat: Chat; message: Message }> {
  perfLog(`DB - createChatWithFirstMessageTransaction start`)
  const dbStart = performance.now()
  return await withRLS(userId, async tx => {
    // 1. Create chat
    const [chat] = await tx
      .insert(chats)
      .values({
        id: chatId,
        title: chatTitle.substring(0, 255),
        userId,
        visibility: 'private',
        createdAt: new Date()
      })
      .returning()

    // 2. Save message
    const dbMessage = mapUIMessageToDBMessage({ ...message, chatId })
    const [savedMessage] = await tx
      .insert(messages)
      .values(dbMessage)
      .returning()

    perfTime('DB - createChatWithFirstMessageTransaction completed', dbStart)
    return { chat, message: savedMessage }
  })
}

// ---------------------------------------------------------------------------
// Canvas artifact actions
// ---------------------------------------------------------------------------

/**
 * Create a new canvas artifact for a chat.
 *
 * The unique index on `chatId` enforces one artifact per chat at the DB level.
 */
export async function createCanvasArtifact(input: {
  id?: string
  chatId: string
  userId: string
  title: string
  draftSource: CanvasSourceFiles
  status?: CanvasArtifactStatus
}) {
  return withOptionalRLS(input.userId, async tx => {
    const [artifact] = await tx
      .insert(canvasArtifacts)
      .values({
        id: input.id ?? generateId(),
        chatId: input.chatId,
        userId: input.userId,
        title: input.title,
        status: input.status ?? 'compiling',
        draftSource: input.draftSource,
        draftRevision: 0,
        updatedAt: new Date()
      })
      .returning()

    return artifact
  })
}

/**
 * Load a canvas artifact by its owning chat ID.
 */
export async function loadCanvasArtifactByChatId(
  chatId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [artifact] = await tx
      .select()
      .from(canvasArtifacts)
      .where(eq(canvasArtifacts.chatId, chatId))
      .limit(1)

    return artifact ?? null
  })
}

/**
 * Load a canvas artifact by its ID.
 *
 * **Security:** When `userId` is `null`, RLS is bypassed and the query runs
 * without row-level permission checks. Callers MUST authenticate through an
 * alternative mechanism (e.g. a signed guest canvas token) before passing
 * `null`. Prefer passing a real `userId` whenever one is available.
 */
export async function loadCanvasArtifactById(
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    const [artifact] = await tx
      .select()
      .from(canvasArtifacts)
      .where(eq(canvasArtifacts.id, artifactId))
      .limit(1)

    return artifact ?? null
  })
}

/**
 * Update the active draft of a canvas artifact with optimistic concurrency.
 *
 * The update only succeeds when the current `draftRevision` matches
 * `expectedRevision`. On success the revision is atomically incremented.
 * Returns the updated row, or `null` if the revision was stale (0 rows
 * affected).
 */
export async function updateCanvasArtifactDraft(input: {
  artifactId: string
  expectedRevision: number
  draftSource?: CanvasSourceFiles
  draftCompiledHtml?: string | null
  draftDiagnostics?: CanvasDiagnostics | null
  status?: CanvasArtifactStatus
  lastCompiledAt?: Date | null
  title?: string
  currentVersionId?: string | null
  userId?: string | null
}) {
  return withOptionalRLS(input.userId ?? null, async tx => {
    const setClause: Record<string, unknown> = {
      draftRevision: sql`${canvasArtifacts.draftRevision} + 1`,
      updatedAt: new Date()
    }

    if (input.draftSource !== undefined)
      setClause.draftSource = input.draftSource
    if (input.draftCompiledHtml !== undefined)
      setClause.draftCompiledHtml = input.draftCompiledHtml
    if (input.draftDiagnostics !== undefined)
      setClause.draftDiagnostics = input.draftDiagnostics
    if (input.status !== undefined) setClause.status = input.status
    if (input.lastCompiledAt !== undefined)
      setClause.lastCompiledAt = input.lastCompiledAt
    if (input.title !== undefined) setClause.title = input.title
    if (input.currentVersionId !== undefined)
      setClause.currentVersionId = input.currentVersionId

    const [updated] = await tx
      .update(canvasArtifacts)
      .set(setClause)
      .where(
        and(
          eq(canvasArtifacts.id, input.artifactId),
          eq(canvasArtifacts.draftRevision, input.expectedRevision)
        )
      )
      .returning()

    return updated ?? null
  })
}

/**
 * Update only the diagnostics of a canvas artifact draft WITHOUT
 * incrementing `draftRevision`.
 *
 * This is used for runtime diagnostic updates that should not interfere
 * with the optimistic concurrency control used by source/compile updates.
 * The update only succeeds when `draftRevision` matches `expectedRevision`,
 * preventing stale diagnostic writes, but does not bump the counter.
 */
export async function updateCanvasArtifactDiagnosticsOnly(input: {
  artifactId: string
  expectedRevision: number
  draftDiagnostics: CanvasDiagnostics
  userId?: string | null
}) {
  return withOptionalRLS(input.userId ?? null, async tx => {
    const [updated] = await tx
      .update(canvasArtifacts)
      .set({
        draftDiagnostics: input.draftDiagnostics,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(canvasArtifacts.id, input.artifactId),
          eq(canvasArtifacts.draftRevision, input.expectedRevision)
        )
      )
      .returning()

    return updated ?? null
  })
}

/**
 * Create an immutable version snapshot from the current draft.
 */
export async function createCanvasArtifactVersion(input: {
  artifactId: string
  versionNumber: number
  sourceSnapshot: CanvasSourceFiles
  createdBy: CanvasVersionCreatedBy
  userId?: string | null
}) {
  return withOptionalRLS(input.userId ?? null, async tx => {
    const [version] = await tx
      .insert(canvasArtifactVersions)
      .values({
        artifactId: input.artifactId,
        versionNumber: input.versionNumber,
        sourceSnapshot: input.sourceSnapshot,
        createdBy: input.createdBy
      })
      .returning()

    return version
  })
}

/**
 * List all immutable versions for a canvas artifact, ordered by creation
 * time descending (newest first).
 */
export async function listCanvasArtifactVersions(
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    return tx
      .select()
      .from(canvasArtifactVersions)
      .where(eq(canvasArtifactVersions.artifactId, artifactId))
      .orderBy(desc(canvasArtifactVersions.createdAt))
  })
}

/**
 * Restore a saved version into the active draft.
 *
 * Loads the version's source snapshot and writes it into the draft,
 * incrementing `draftRevision` via the standard optimistic concurrency
 * path. Returns the updated artifact row, or `null` if the revision was
 * stale.
 */
export async function restoreCanvasArtifactVersion(input: {
  artifactId: string
  versionId: string
  expectedRevision: number
  userId?: string | null
}) {
  return withOptionalRLS(input.userId ?? null, async tx => {
    // Load the version to restore
    const [version] = await tx
      .select()
      .from(canvasArtifactVersions)
      .where(eq(canvasArtifactVersions.id, input.versionId))
      .limit(1)

    if (!version) return null

    // Apply the restored source to the draft with optimistic concurrency
    const [updated] = await tx
      .update(canvasArtifacts)
      .set({
        draftSource: version.sourceSnapshot,
        draftCompiledHtml: null,
        draftDiagnostics: null,
        status: 'restoring',
        draftRevision: sql`${canvasArtifacts.draftRevision} + 1`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(canvasArtifacts.id, input.artifactId),
          eq(canvasArtifacts.draftRevision, input.expectedRevision)
        )
      )
      .returning()

    return updated ?? null
  })
}
