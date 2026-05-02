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

function getToolResultContinuation(messages: UIMessage[], messageId?: string) {
  const lastMessage = messages[messages.length - 1]
  if (
    !lastMessage ||
    lastMessage.role !== 'assistant' ||
    lastMessage.id !== messageId ||
    !Array.isArray(lastMessage.parts)
  ) {
    return undefined
  }

  for (let index = lastMessage.parts.length - 1; index >= 0; index--) {
    const part = lastMessage.parts[index] as {
      type?: string
      state?: string
      toolCallId?: string
      output?: unknown
    }

    if (
      part.state === 'output-available' &&
      isInteractiveToolPart(part) &&
      typeof part.toolCallId === 'string' &&
      part.toolCallId &&
      'output' in part
    ) {
      return {
        toolCallId: part.toolCallId,
        output: part.output
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
  const toolResult =
    trigger === 'submit-message'
      ? getToolResultContinuation(messages, messageId)
      : undefined
  const effectiveTrigger = toolResult ? 'tool-result' : trigger

  return {
    body: {
      trigger: effectiveTrigger,
      chatId,
      messageId,
      messages,
      ...(guestCanvasToken ? { guestCanvasToken } : {}),
      ...(toolResult ? { toolResult } : {}),
      ...(effectiveTrigger === 'regenerate-message' &&
      messageToRegenerate?.role === 'user'
        ? { message: messageToRegenerate }
        : effectiveTrigger === 'submit-message'
          ? { message: lastMessage }
          : {}),
      ...(effectiveTrigger === 'submit-message'
        ? {
            isNewChat: messages.length === 1 && savedMessagesCount === 0
          }
        : {})
    }
  }
}
