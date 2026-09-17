import type { UIMessage } from '@/lib/types/ai'

/**
 * Whether prior assistant reasoning must be stripped before conversion for
 * this model.
 *
 * - OpenAI's Responses API requires reasoning items and their following items
 *   to be kept together (see the note on stripReasoningParts below).
 * - DeepSeek (via OpenRouter) attaches provider-specific `reasoning_details`
 *   metadata that should not be replayed on the next turn; replaying it risks
 *   400s or silent drops.
 */
export function needsReasoningStrip(modelId: string): boolean {
  return (
    modelId.startsWith('openai:') || modelId.startsWith('openrouter:deepseek/')
  )
}

/**
 * Strips reasoning parts from UIMessages for OpenAI models.
 *
 * OpenAI's Responses API requires reasoning items and their following items
 * (tool-calls or text) to be kept together. The AI SDK's convertToModelMessages
 * doesn't properly handle these requirements, causing errors like:
 * "Item 'rs_...' of type 'reasoning' was provided without its required following item"
 *
 * By stripping reasoning parts before conversion, we avoid this compatibility issue.
 *
 * @see https://github.com/vercel/ai/issues/11036
 */
export function stripReasoningParts(messages: UIMessage[]): UIMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant' || !msg.parts) {
      return msg
    }

    const filteredParts = msg.parts.filter(part => part.type !== 'reasoning')

    // If all parts were reasoning, keep the original message
    if (filteredParts.length === 0) {
      return msg
    }

    return { ...msg, parts: filteredParts }
  })
}

const SETTLED_TOOL_STATES = new Set(['output-available', 'output-error'])

/**
 * Reduces an aborted assistant message to the parts that are safe to persist
 * and replay on the next turn, or returns null when nothing visible is left.
 *
 * - A tool call cut off before its result would be replayed as a tool-call
 *   with no tool-result, which providers reject.
 * - A reasoning-only message survives `stripReasoningParts` untouched (it keeps
 *   all-reasoning messages), so persisting one would replay provider reasoning
 *   metadata. It also has no visible answer worth keeping.
 */
export function toReplaySafeAbortedMessage(
  message: UIMessage
): UIMessage | null {
  const parts = (message.parts ?? []).filter(part => {
    if (part.type === 'text') return part.text.trim().length > 0
    if ('toolCallId' in part) return SETTLED_TOOL_STATES.has(part.state)
    return true
  })
  const hasVisibleContent = parts.some(
    part => part.type === 'text' || 'toolCallId' in part
  )
  return hasVisibleContent ? { ...message, parts } : null
}
