import type { UIMessage, UIMessageMetadata } from '@/lib/types/ai'

/**
 * Convert UI message to DB message (excluding parts)
 */
export function mapUIMessageToDBMessage(
  message: UIMessage & { id: string; chatId: string }
): {
  id: string
  chatId: string
  role: string
  uiMessage: UIMessage
  metadata?: UIMessageMetadata | null
} {
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    uiMessage: message,
    metadata: message.metadata || null
  }
}

/**
 * Build a UIMessage from a DB message row. Every row must have a populated
 * uiMessage column — throws if the invariant is violated.
 */
export function buildUIMessageFromDB(dbMessage: {
  id: string
  role: string
  uiMessage?: UIMessage | null
  metadata?: UIMessageMetadata | null
  createdAt?: Date | string
}): UIMessage {
  if (!dbMessage.uiMessage) {
    throw new Error(`Invariant: message ${dbMessage.id} has no uiMessage`)
  }

  const createdAt =
    dbMessage.createdAt instanceof Date
      ? dbMessage.createdAt
      : dbMessage.createdAt
        ? new Date(dbMessage.createdAt)
        : undefined

  const mergedMetadata: UIMessageMetadata = {
    ...(dbMessage.uiMessage.metadata || {}),
    ...(dbMessage.metadata || {}),
    ...(createdAt ? { createdAt } : {})
  }

  return {
    ...dbMessage.uiMessage,
    id: dbMessage.uiMessage.id || dbMessage.id,
    role: (dbMessage.uiMessage.role || dbMessage.role) as 'user' | 'assistant',
    metadata:
      Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined
  }
}
