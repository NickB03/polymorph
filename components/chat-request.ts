import type { CanvasArtifactStatusData, UIMessage } from '@/lib/types/ai'

/**
 * Search messages for the most recent `data-canvasArtifactStatus` part
 * and return its `guestCanvasToken` (if present).
 */
export function getLatestGuestCanvasToken(
  messages: UIMessage[]
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].parts
    if (!parts) continue
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j] as {
        type?: string
        data?: CanvasArtifactStatusData
      }
      if (
        part.type === 'data-canvasArtifactStatus' &&
        part.data?.guestCanvasToken
      ) {
        return part.data.guestCanvasToken
      }
    }
  }
  return undefined
}

export function buildChatRequestBody({
  messages,
  trigger,
  messageId,
  chatId,
  isGuest: _isGuest,
  savedMessagesCount,
  guestCanvasToken
}: {
  messages: UIMessage[]
  trigger: 'submit-message' | 'regenerate-message' | undefined
  messageId: string | undefined
  chatId: string
  isGuest: boolean
  savedMessagesCount: number
  guestCanvasToken?: string
}) {
  return {
    body: {
      trigger,
      chatId,
      messageId,
      messages,
      ...(guestCanvasToken ? { guestCanvasToken } : {}),
      ...(trigger === 'submit-message'
        ? {
            isNewChat: messages.length === 1 && savedMessagesCount === 0
          }
        : {})
    }
  }
}
