import { UIMessage } from 'ai'

import { upsertMessage } from '@/lib/actions/chat'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'

import type { StreamContext } from './types'

export interface ToolResultDelta {
  toolCallId: string
  output: unknown
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
    throw new Error('Chat not found or has no messages')
  }

  const messages = initialChat.messages
  const lastMessage = messages[messages.length - 1]

  if (lastMessage.role !== 'assistant') {
    throw new Error('Last message is not an assistant message')
  }

  if (!lastMessage.parts) {
    throw new Error('Assistant message has no parts')
  }

  // Find the matching tool part by toolCallId
  const matchingPartIndex = lastMessage.parts.findIndex(
    (p: any) => p.toolCallId === toolResult.toolCallId
  )

  if (matchingPartIndex === -1) {
    throw new Error(
      `No tool part found with toolCallId: ${toolResult.toolCallId}`
    )
  }

  // Clone the assistant message and apply the tool result
  const updatedParts = lastMessage.parts.map((p: any, i: number) => {
    if (i === matchingPartIndex) {
      return {
        ...p,
        state: 'output-available',
        output: toolResult.output
      }
    }
    return p
  })

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
