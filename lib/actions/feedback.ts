// Server-only: this helper takes a caller-supplied userId and must never be
// exposed as a Server Action (its only caller is app/api/feedback/route.ts,
// which authenticates first).
import { and, eq } from 'drizzle-orm'

import { chats, messages } from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'
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
  userId: string
): Promise<MessageFeedbackUpdateResult> {
  try {
    // RLS is defense in depth only; ownership is enforced explicitly below.
    const result = await withRLS<MessageFeedbackUpdateResult>(
      userId,
      async tx => {
        // Get the current message to preserve existing metadata and get
        // chatId. Only a message in one of the user's own chats matches, so
        // another user's message reports not-found.
        const [currentMessage] = await tx
          .select({
            metadata: messages.metadata,
            chatId: messages.chatId
          })
          .from(messages)
          .innerJoin(chats, eq(chats.id, messages.chatId))
          .where(and(eq(messages.id, messageId), eq(chats.userId, userId)))
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
          // Pinned to the chat whose ownership was verified above.
          .where(
            and(
              eq(messages.id, messageId),
              eq(messages.chatId, currentMessage.chatId)
            )
          )
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
