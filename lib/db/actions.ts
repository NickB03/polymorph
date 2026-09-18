import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'

import type { UIMessage } from '@/lib/types/ai'
import type {
  CanvasArtifactStatus,
  CanvasDiagnostics,
  CanvasSourceFiles,
  CanvasVersionCreatedBy
} from '@/lib/types/canvas'
import type { PersistableUIMessage } from '@/lib/types/message-persistence'
import {
  buildUIMessageFromDB,
  mapUIMessageToDBMessage
} from '@/lib/utils/message-mapping'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { incrementDbOperationCount } from '@/lib/utils/perf-tracking'

import type { Chat, Message } from './schema'
import {
  canvasArtifacts,
  canvasArtifactVersions,
  chats,
  generateId,
  messages
} from './schema'
import type { DbInstance, TxInstance } from './with-rls'
import { withOptionalRLS, withRLS } from './with-rls'
import { db } from '.'

function hasDisplayableChatContent() {
  return sql`(
    EXISTS (
      SELECT 1
      FROM ${messages}
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(${messages.uiMessage}->'parts') = 'array'
          THEN ${messages.uiMessage}->'parts'
          ELSE '[]'::jsonb
        END
      ) AS message_part(value)
      WHERE ${messages.chatId} = ${chats.id}
      AND message_part.value->>'type' IS NOT NULL
      AND message_part.value->>'type' NOT IN (
        'data-canvasArtifactStatus',
        'data-canvasArtifactEvent',
        'data-canvasDiagnostics',
        'step-start'
      )
      AND (
        message_part.value->>'type' <> 'text'
        OR length(btrim(coalesce(message_part.value->>'text', ''))) > 0
      )
      AND (
        message_part.value->>'type' <> 'reasoning'
        OR length(btrim(coalesce(message_part.value->>'text', ''))) > 0
        OR (
          CASE
            WHEN jsonb_typeof(message_part.value->'details') = 'array'
            THEN jsonb_array_length(message_part.value->'details')
            ELSE 0
          END
        ) > 0
      )
    )
    OR EXISTS (
      SELECT 1
      FROM ${canvasArtifacts}
      WHERE ${canvasArtifacts.chatId} = ${chats.id}
    )
  )`
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
 * Owner of an existing chat row, or null when there is none. Lets the chat
 * route reject a client-claimed "new" chat id that already belongs to someone
 * else without loading the chat's messages.
 */
export async function getChatOwnerId(chatId: string): Promise<string | null> {
  const [chat] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  return chat?.userId ?? null
}

/**
 * Explicit ownership check. RLS is defense in depth only: the app's DB role
 * may bypass it, so writers must not rely on it for cross-user authorization.
 */
async function assertChatOwner(
  tx: TxInstance | DbInstance,
  chatId: string,
  userId: string
): Promise<void> {
  const [chat] = await tx
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (chat?.userId !== userId) {
    throw new Error('Unauthorized: chat does not belong to this user')
  }
}

/**
 * Runs a write to a chat's messages in a transaction that first takes a
 * per-chat advisory lock, so message writers for one chat run one at a time.
 * That is what makes a read-then-write (the stale guard below, or a delete
 * computed from a fresh read) atomic under READ COMMITTED.
 *
 * Every writer that inserts or deletes a chat's messages must go through this:
 * the lock only serializes transactions that take it. It is released on
 * commit/rollback. `hashtext` is 32-bit, so two chats can share a key; that
 * only costs a brief unnecessary wait, never correctness.
 *
 * With a `userId` the chat must belong to that user, checked here so every
 * message writer is covered; the write throws otherwise.
 */
async function withChatMessagesLock<T>(
  chatId: string,
  userId: string | undefined,
  callback: (tx: TxInstance) => Promise<T>
): Promise<T> {
  const locked = async (tx: TxInstance) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${chatId}))`)
    if (userId) await assertChatOwner(tx, chatId, userId)
    return callback(tx)
  }
  // Always a real transaction: a transaction-scoped lock taken on a bare
  // connection would be released before the write ran.
  return userId ? withRLS(userId, locked) : db.transaction(locked)
}

/**
 * Only write if the chat has not moved on: its latest message must still be
 * `latestId` and must not have been edited after `since`.
 */
export type StaleGuard = { latestId: string; since: Date }

/**
 * Upsert a message with its parts
 * Note: This function should be called with appropriate userId context
 */
export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  userId?: string
): Promise<Message>
export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  userId: string | undefined,
  staleGuard: StaleGuard
): Promise<Message | null>
export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  userId?: string,
  staleGuard?: StaleGuard
): Promise<Message | null> {
  const count = incrementDbOperationCount()
  perfLog(`DB - upsertMessage called - count: ${count}`)

  const executeFn = (callback: (tx: TxInstance) => Promise<Message | null>) =>
    withChatMessagesLock(message.chatId, userId, callback)

  const result = await executeFn(async tx => {
    if (staleGuard) {
      // Atomic with the insert below: the per-chat lock keeps a newer turn
      // (or an edit's delete) from committing between this read and the write.
      const [latest] = await tx
        .select({ id: messages.id, updatedAt: messages.updatedAt })
        .from(messages)
        .where(eq(messages.chatId, message.chatId))
        .orderBy(desc(messages.createdAt))
        .limit(1)
      if (
        latest?.id !== staleGuard.latestId ||
        (latest.updatedAt && latest.updatedAt > staleGuard.since)
      ) {
        return null
      }
    }

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
        },
        // Never overwrite a message that lives in a different chat.
        setWhere: eq(messages.chatId, message.chatId)
      })
      .returning()

    if (!dbMessage) {
      throw new Error(`Message ${message.id} belongs to a different chat`)
    }

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

    return result.map(message => buildUIMessageFromDB(message))
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

    const uiMessages = messagesResult.map(message =>
      buildUIMessageFromDB(message)
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
  return withChatMessagesLock(chatId, userId, async tx => {
    // Get the message's timestamp
    const [targetMessage] = await tx
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.chatId, chatId)))
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
 * Delete messages from a specific index. With `inclusive: false` the target
 * message is kept and only what follows it (per a fresh read, not a caller's
 * snapshot) is deleted.
 */
export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string,
  userId?: string,
  inclusive = true
): Promise<{ count: number }> {
  return withChatMessagesLock(chatId, userId, async tx => {
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
    const messagesToDelete = allMessages.slice(
      inclusive ? messageIndex : messageIndex + 1
    )
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
      .where(and(eq(chats.userId, userId), hasDisplayableChatContent()))
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
        .where(and(eq(chats.userId, userId), hasDisplayableChatContent()))
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
    // Read on the parent transaction. Calling getChat() here would open a
    // second pooled connection nested inside this one, holding two connections
    // per call and risking pool exhaustion / self-deadlock under concurrency.
    const [chat] = await tx
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1)
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
  userId: string
): Promise<Chat | null> {
  return withRLS(userId, async tx => {
    const [updatedChat] = await tx
      .update(chats)
      .set({ title })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
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
 * Explicit owner predicate for canvas artifact queries (RLS is defense in
 * depth only). A null/absent userId means the caller authenticated another
 * way (a signed guest canvas token), so no owner predicate applies.
 */
function canvasArtifactOwnedBy(userId?: string | null) {
  return userId ? eq(canvasArtifacts.userId, userId) : undefined
}

/**
 * Versions carry no userId; access goes through the parent artifact's owner.
 */
async function canAccessCanvasArtifact(
  tx: TxInstance | DbInstance,
  artifactId: string,
  userId?: string | null
): Promise<boolean> {
  if (!userId) return true

  const [artifact] = await tx
    .select({ id: canvasArtifacts.id })
    .from(canvasArtifacts)
    .where(
      and(eq(canvasArtifacts.id, artifactId), canvasArtifactOwnedBy(userId))
    )
    .limit(1)

  return !!artifact
}

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
    await assertChatOwner(tx, input.chatId, input.userId)

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
      .where(
        and(eq(canvasArtifacts.chatId, chatId), canvasArtifactOwnedBy(userId))
      )
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
      .where(
        and(eq(canvasArtifacts.id, artifactId), canvasArtifactOwnedBy(userId))
      )
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
          eq(canvasArtifacts.draftRevision, input.expectedRevision),
          canvasArtifactOwnedBy(input.userId)
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
          eq(canvasArtifacts.draftRevision, input.expectedRevision),
          canvasArtifactOwnedBy(input.userId)
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
    if (!(await canAccessCanvasArtifact(tx, input.artifactId, input.userId))) {
      throw new Error('Unauthorized: canvas artifact does not belong to user')
    }

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
 *
 * Deliberately omits `sourceSnapshot`: it is the whole artifact source per
 * row, and every caller but the restore path only needs the metadata. Use
 * `loadCanvasArtifactVersionSnapshot` when the source is actually needed.
 */
export async function listCanvasArtifactVersions(
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    if (!(await canAccessCanvasArtifact(tx, artifactId, userId))) return []

    return tx
      .select({
        id: canvasArtifactVersions.id,
        artifactId: canvasArtifactVersions.artifactId,
        versionNumber: canvasArtifactVersions.versionNumber,
        createdBy: canvasArtifactVersions.createdBy,
        createdAt: canvasArtifactVersions.createdAt
      })
      .from(canvasArtifactVersions)
      .where(eq(canvasArtifactVersions.artifactId, artifactId))
      .orderBy(desc(canvasArtifactVersions.createdAt))
  })
}

/**
 * Load one version's source snapshot, scoped to its artifact.
 */
export async function loadCanvasArtifactVersionSnapshot(
  versionId: string,
  artifactId: string,
  userId?: string | null
) {
  return withOptionalRLS(userId ?? null, async tx => {
    if (!(await canAccessCanvasArtifact(tx, artifactId, userId))) return null

    const [version] = await tx
      .select({
        id: canvasArtifactVersions.id,
        versionNumber: canvasArtifactVersions.versionNumber,
        sourceSnapshot: canvasArtifactVersions.sourceSnapshot
      })
      .from(canvasArtifactVersions)
      .where(
        and(
          eq(canvasArtifactVersions.id, versionId),
          eq(canvasArtifactVersions.artifactId, artifactId)
        )
      )
      .limit(1)

    return version ?? null
  })
}

/**
 * Delete canvas artifact versions by id, scoped to their artifact.
 */
export async function deleteCanvasArtifactVersions(
  artifactId: string,
  versionIds: string[],
  userId?: string | null
) {
  if (versionIds.length === 0) return

  return withOptionalRLS(userId ?? null, async tx => {
    if (!(await canAccessCanvasArtifact(tx, artifactId, userId))) return

    await tx
      .delete(canvasArtifactVersions)
      .where(
        and(
          eq(canvasArtifactVersions.artifactId, artifactId),
          inArray(canvasArtifactVersions.id, versionIds)
        )
      )
  })
}
