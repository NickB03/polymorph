import type { CanvasArtifactStatusData, UIMessage } from '@/lib/types/ai'
import { isInteractiveToolPart } from '@/lib/types/dynamic-tools'

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
  isGuest,
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

  const isToolResultContinuation =
    trigger === 'submit-message' && lastMessage?.role === 'assistant'

  if (isToolResultContinuation) {
    // Use findLast to get the most recently resolved interactive tool part.
    // When multiple displayOptionList calls are resolved sequentially,
    // the first one is already persisted — we need the latest one.
    const resolvedPart = lastMessage?.parts?.findLast(
      part =>
        isInteractiveToolPart(part) &&
        'state' in part &&
        part.state === 'output-available' &&
        'output' in part
    ) as { toolCallId: string; output: unknown } | undefined

    if (resolvedPart && resolvedPart.output !== undefined) {
      return {
        body: {
          trigger: 'tool-result' as const,
          chatId,
          toolResult: {
            toolCallId: resolvedPart.toolCallId,
            output: resolvedPart.output
          },
          ...(isGuest ? { messages } : {}),
          ...(guestCanvasToken ? { guestCanvasToken } : {})
        }
      }
    }
  }

  return {
    body: {
      trigger,
      chatId,
      messageId,
      ...(isGuest ? { messages } : {}),
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
