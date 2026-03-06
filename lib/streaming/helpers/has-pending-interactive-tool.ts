import type { ModelMessage } from 'ai'

/**
 * Check if the response ends with a pending interactive tool (e.g. displayOptionList)
 * that is waiting for user input. When true, related questions should be suppressed.
 */
export function hasPendingInteractiveTool(
  responseMessages: ModelMessage[]
): boolean {
  if (!responseMessages || responseMessages.length === 0) return false
  const lastMsg = responseMessages[responseMessages.length - 1]
  if (lastMsg.role !== 'assistant' || typeof lastMsg.content === 'string')
    return false
  const toolCalls = lastMsg.content.filter(
    (p: { type: string }) => p.type === 'tool-call'
  )
  if (toolCalls.length === 0) return false
  // Collect all tool-result IDs from subsequent tool messages
  const resolvedIds = new Set(
    responseMessages
      .filter(
        (m): m is Extract<ModelMessage, { role: 'tool' }> => m.role === 'tool'
      )
      .flatMap(m =>
        m.content.filter(p => p.type === 'tool-result').map(p => p.toolCallId)
      )
  )
  // If any tool call has no result, the agent stopped for user input
  return toolCalls.some((tc: { type: string; toolCallId?: string }) =>
    tc.toolCallId ? !resolvedIds.has(tc.toolCallId) : false
  )
}
