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
  trigger: 'submit-message' | 'regenerate-message' | 'tool-result' | undefined
  messageId: string | undefined
  chatId: string
  isGuest: boolean
  savedMessagesCount: number
  guestCanvasToken?: string
}) {
  const lastMessage = messages[messages.length - 1]
  const messageToRegenerate =
    trigger === 'regenerate-message'
      ? messages.find(message => message.id === messageId)
      : undefined

  return {
    body: {
      trigger,
      chatId,
      messageId,
      messages,
      ...(guestCanvasToken ? { guestCanvasToken } : {}),
      message:
        trigger === 'regenerate-message' && messageToRegenerate?.role === 'user'
          ? messageToRegenerate
          : trigger === 'submit-message'
            ? lastMessage
            : undefined,
      isNewChat:
        trigger === 'submit-message' &&
        messages.length === 1 &&
        savedMessagesCount === 0
    }
  }
}
