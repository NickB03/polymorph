// Server-only: this helper takes a caller-supplied userId and must never be
// exposed as a Server Action (its only caller is app/api/feedback/route.ts,
// which authenticates first).
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'
import type { UIMessageMetadata } from '@/lib/types/ai'

export type MessageFeedbackUpdateResult =
  | {
      success: true
      chatId: string
      metadata: UIMessageMetadata | null
    }
  | { success: false; error?: string; notFound?: true }

export async function updateMessageFeedback(
  messageId: string,
  score: number,
  userId: string | null = null
): Promise<MessageFeedbackUpdateResult> {
  try {
    // Use RLS context for all database operations
    const result = await withOptionalRLS<MessageFeedbackUpdateResult>(
      userId,
      async tx => {
        // Get the current message to preserve existing metadata and get chatId
        const [currentMessage] = await tx
          .select({
            metadata: messages.metadata,
            chatId: messages.chatId
          })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1)

        if (!currentMessage) {
          return { success: false, error: 'Message not found', notFound: true }
        }

        // Merge the feedback score with existing metadata
        const updatedMetadata = {
          ...(currentMessage.metadata || {}),
          feedbackScore: score
        }

        // Update the message with the new feedback score. RLS can make the
        // UPDATE a no-op even though the SELECT above succeeded, so treat a
        // zero-row result as a failure rather than reporting success.
        const updated = await tx
          .update(messages)
          .set({ metadata: updatedMetadata })
          .where(eq(messages.id, messageId))
          .returning({ id: messages.id })

        if (updated.length === 0) {
          return {
            success: false,
            error: 'Feedback update affected no rows',
            notFound: true
          }
        }

        return {
          success: true,
          chatId: currentMessage.chatId,
          metadata: currentMessage.metadata as UIMessageMetadata | null
        }
      }
    )

    if (!result.success) {
      return result
    }

    return {
      success: true,
      chatId: result.chatId,
      metadata: result.metadata
    }
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update feedback'
    }
  }
}
