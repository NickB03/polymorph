import { revalidateTag } from 'next/cache'

import { createChatWithFirstMessage, upsertMessage } from '@/lib/actions/chat'
import { DEFAULT_CHAT_TITLE } from '@/lib/constants'
import { updateChatTitle } from '@/lib/db/actions'
import type { UIMessage } from '@/lib/types/ai'
import type { ModelType } from '@/lib/types/model-type'
import { UserMode } from '@/lib/types/search'
import { perfTime } from '@/lib/utils/perf-logging'
import { retryDatabaseOperation } from '@/lib/utils/retry'

export async function persistStreamResults(
  responseMessage: UIMessage,
  chatId: string,
  userId: string,
  titlePromise?: Promise<string>,
  correlationId?: string,
  userMode?: UserMode,
  modelId?: string,
  initialSavePromise?: Promise<
    Awaited<ReturnType<typeof createChatWithFirstMessage>>
  >,
  initialUserMessage?: UIMessage,
  modelType?: ModelType,
  otelTraceId?: string
) {
  // Attach metadata to the response message
  responseMessage.metadata = {
    ...(responseMessage.metadata || {}),
    ...(correlationId && { correlationId }),
    ...(otelTraceId && { otelTraceId }),
    ...(userMode && { userMode }),
    ...(modelId && { modelId }),
    ...(modelType && { modelType })
  }

  // Ensure the initial chat/message persistence finished before saving the response
  if (initialSavePromise) {
    const initialSaveStart = performance.now()
    try {
      await initialSavePromise
      perfTime('initial chat persistence awaited', initialSaveStart)
    } catch (error) {
      console.error('Initial chat persistence failed:', error)
      if (initialUserMessage) {
        const fallbackStart = performance.now()
        try {
          await createChatWithFirstMessage(
            chatId,
            initialUserMessage,
            userId,
            DEFAULT_CHAT_TITLE
          )
          perfTime('initial chat persistence fallback completed', fallbackStart)
        } catch (fallbackError) {
          // Check if the error is due to duplicate key (chat already exists)
          const isDuplicateKey =
            fallbackError instanceof Error &&
            (fallbackError.message.includes('duplicate key') ||
              fallbackError.message.includes('unique constraint'))

          if (isDuplicateKey) {
            // The chat row already exists, but the initial user message may not.
            console.log(
              'Chat already exists (duplicate key), persisting initial user message'
            )
            try {
              await upsertMessage(chatId, initialUserMessage, userId)
              perfTime(
                'initial chat persistence - duplicate recovered via upsert',
                fallbackStart
              )
            } catch (persistError) {
              console.error(
                'Fallback initial user message persistence failed:',
                persistError
              )
              return
            }
          } else {
            // Other error - log and return
            console.error('Fallback chat creation failed:', fallbackError)
            return
          }
        }
      } else {
        return
      }
    }
  }

  // Save message with retry logic
  const saveStart = performance.now()
  let messageSaved = false
  try {
    await upsertMessage(chatId, responseMessage, userId)
    messageSaved = true
    perfTime('upsertMessage (AI response) completed', saveStart)
  } catch (error) {
    console.error('Error saving message:', error)
    try {
      await retryDatabaseOperation(
        () => upsertMessage(chatId, responseMessage, userId),
        'save message'
      )
      messageSaved = true
      perfTime('upsertMessage (AI response) completed after retry', saveStart)
    } catch (retryError) {
      console.error(
        `Failed to save message after retries: chatId=${chatId}`,
        retryError
      )
      // Don't throw here to avoid breaking the stream
    }
  }

  if (messageSaved) {
    // Route-handler writes need immediate expiration so reloads observe the
    // just-persisted canonical UIMessage instead of a stale chat transcript.
    revalidateTag(`chat-${chatId}`, { expire: 0 })
  }

  // Wait for title generation AFTER message is saved — title generation is a
  // model API call that can take seconds and must never block message persistence,
  // otherwise tool-result continuations fail because the assistant message isn't
  // in the DB yet when prepareToolResultMessages loads the chat.
  const chatTitle = titlePromise ? await titlePromise : undefined

  // Update title after message is saved
  if (chatTitle && chatTitle !== DEFAULT_CHAT_TITLE) {
    try {
      await updateChatTitle(chatId, chatTitle, userId)
      // updateChatTitle is a raw DB call that bypasses the action wrapper,
      // so it never invalidates the cache on its own. Do it here.
      revalidateTag(`chat-${chatId}`, 'max')
    } catch (error) {
      console.error('Error updating title:', error)
      // Don't throw here as title update is not critical
    }
  }
}
