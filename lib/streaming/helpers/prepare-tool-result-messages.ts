import { upsertMessage } from '@/lib/actions/chat'
import type { UIMessage } from '@/lib/types/ai'
import { isInteractiveToolPart } from '@/lib/types/dynamic-tools'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'

import type { StreamContext } from './types'

export interface ToolResultDelta {
  toolCallId: string
  output: unknown
}

export class ToolResultValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolResultValidationError'
  }
}

/**
 * Reconstructs the full message array for a tool-result continuation.
 *
 * Instead of trusting a client-provided messages array (prompt injection risk),
 * this rebuilds from the server's DB state (context.initialChat), applies the
 * tool result to the matching part, and persists the updated assistant message.
 */
export async function prepareToolResultMessages(
  context: StreamContext,
  toolResult: ToolResultDelta
): Promise<UIMessage[]> {
  const startTime = performance.now()
  perfLog('prepareToolResultMessages - Start')

  const { chatId, userId, initialChat } = context

  if (!initialChat || !initialChat.messages.length) {
    throw new ToolResultValidationError('Chat not found or has no messages')
  }

  const messages = initialChat.messages
  const lastMessage = messages[messages.length - 1]

  if (lastMessage.role !== 'assistant') {
    throw new ToolResultValidationError(
      'Last message is not an assistant message'
    )
  }

  if (!lastMessage.parts) {
    throw new ToolResultValidationError('Assistant message has no parts')
  }

  // Find the matching interactive tool part by toolCallId
  const matchingPartIndex = lastMessage.parts.findIndex(
    p =>
      'toolCallId' in p &&
      (p as { toolCallId: string }).toolCallId === toolResult.toolCallId
  )

  if (matchingPartIndex === -1) {
    throw new ToolResultValidationError(
      `No tool part found with toolCallId: ${toolResult.toolCallId}`
    )
  }

  const matchedPart = lastMessage.parts[matchingPartIndex]
  if (!isInteractiveToolPart(matchedPart)) {
    throw new ToolResultValidationError(
      `Tool part with toolCallId ${toolResult.toolCallId} is not an interactive tool`
    )
  }

  if ('state' in matchedPart && matchedPart.state !== 'input-available') {
    throw new ToolResultValidationError(
      `Tool part with toolCallId ${toolResult.toolCallId} is not awaiting input (state: ${(matchedPart as { state: string }).state})`
    )
  }

  // Clone the assistant message and apply the tool result.
  // Type assertion is safe: we only modify the validated interactive tool part
  // at matchingPartIndex, but TS can't narrow through .map() over a union.
  const updatedParts = lastMessage.parts.map((p, i) => {
    if (i === matchingPartIndex) {
      return {
        ...p,
        state: 'output-available' as const,
        output: toolResult.output
      }
    }
    return p
  }) as typeof lastMessage.parts

  const updatedAssistantMessage: UIMessage = {
    ...lastMessage,
    parts: updatedParts
  }

  // Persist the updated assistant message with the tool result
  await upsertMessage(chatId, updatedAssistantMessage, userId)

  perfTime('prepareToolResultMessages - Total', startTime)

  // Return all messages with the last one updated
  return [...messages.slice(0, -1), updatedAssistantMessage]
}
