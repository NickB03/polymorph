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
