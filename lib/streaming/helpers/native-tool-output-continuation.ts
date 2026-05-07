import type { UIMessage } from '@/lib/types/ai'
import { isInteractiveToolPart } from '@/lib/types/dynamic-tools'

export function hasNativeInteractiveToolOutput(
  messages: UIMessage[] | undefined
): boolean {
  const lastMessage = messages?.[messages.length - 1]
  if (
    !lastMessage ||
    lastMessage.role !== 'assistant' ||
    !Array.isArray(lastMessage.parts)
  ) {
    return false
  }

  return lastMessage.parts.some(part => {
    const candidate = part as {
      state?: string
      toolCallId?: string
      output?: unknown
    }
    return (
      candidate.state === 'output-available' &&
      isInteractiveToolPart(part) &&
      typeof candidate.toolCallId === 'string' &&
      candidate.toolCallId.length > 0 &&
      'output' in candidate
    )
  })
}
