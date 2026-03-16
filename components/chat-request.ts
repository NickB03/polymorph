import type { UIMessage } from '@/lib/types/ai'
import { isInteractiveToolPart } from '@/lib/types/dynamic-tools'

export function getLatestGuestArtifactToken(
  messages: UIMessage[]
): string | null {
  let latestToken: string | null = null

  for (const message of messages) {
    if (message.role !== 'assistant') continue

    for (const part of message.parts ?? []) {
      if (
        (part.type === 'data-artifact' ||
          part.type === 'data-artifactStatus') &&
        typeof part.data === 'object' &&
        part.data !== null &&
        'guestArtifactToken' in part.data &&
        typeof part.data.guestArtifactToken === 'string'
      ) {
        latestToken = part.data.guestArtifactToken
      }
    }
  }

  return latestToken
}

export function buildChatRequestBody({
  messages,
  trigger,
  messageId,
  chatId,
  isGuest,
  guestArtifactToken,
  savedMessagesCount
}: {
  messages: UIMessage[]
  trigger: 'submit-message' | 'regenerate-message' | 'tool-result' | undefined
  messageId: string | undefined
  chatId: string
  isGuest: boolean
  guestArtifactToken: string | null
  savedMessagesCount: number
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
          ...(isGuest && guestArtifactToken ? { guestArtifactToken } : {})
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
      ...(isGuest && guestArtifactToken ? { guestArtifactToken } : {}),
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
