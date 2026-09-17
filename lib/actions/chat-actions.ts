'use server'

import { revalidateTag } from 'next/cache'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'

// Server Actions reachable from the browser. Everything here derives the
// acting user from the session — never from a caller-supplied argument.
// Server-only chat helpers (which do take a userId) live in ./chat.

/**
 * Delete a chat owned by the current user
 */
export async function deleteChat(chatId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'User not authenticated' }
  }

  const result = await dbActions.deleteChat(chatId, userId)

  if (result.success) {
    revalidateTag(`chat-${chatId}`, 'max')
  }

  return result
}

/**
 * Clear all chats for the current user
 */
export async function clearChats() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'User not authenticated' }
  }

  const result = await dbActions.clearAllChats(userId)
  if (result.success) {
    revalidateTag('chat', 'max')
  }
  return result
}
