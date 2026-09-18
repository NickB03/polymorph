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
 * - Z.ai GLM (via OpenRouter or the Gateway fallback) returns
 *   `reasoning_details` per step. The SDK replays them within a tool loop
 *   (required); across user turns they are stale, inflate the prompt, and
 *   trigger missing-signature warnings.
 */
export function needsReasoningStrip(modelId: string): boolean {
  return (
    modelId.startsWith('openai:') ||
    modelId.startsWith('openrouter:deepseek/') ||
    modelId.startsWith('openrouter:z-ai/') ||
    modelId.startsWith('gateway:zai/')
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
  return messages.flatMap(msg => {
    if (msg.role !== 'assistant' || !msg.parts) {
      return [msg]
    }

    const filteredParts = msg.parts.filter(part => part.type !== 'reasoning')

    // A reasoning-only turn (e.g. the model spent its whole output budget
    // thinking) has nothing replayable. Keeping it would replay exactly the
    // reasoning metadata this function exists to remove, so drop the message.
    if (filteredParts.length === 0) {
      return []
    }

    return [{ ...msg, parts: filteredParts }]
  })
}

const SETTLED_TOOL_STATES = new Set(['output-available', 'output-error'])

/**
 * Reduces an aborted assistant message to the parts that are safe to persist
 * and replay on the next turn, or returns null when nothing visible is left.
 *
 * - A tool call cut off before its result would be replayed as a tool-call
 *   with no tool-result, which providers reject.
 * - A reasoning-only message has no visible answer worth keeping, and models
 *   that skip `stripReasoningParts` would replay its provider reasoning
 *   metadata.
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
