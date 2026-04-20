import type { UIMessage } from '@/lib/types/ai'

/**
 * Regex matching ```json fenced code blocks inside text parts.
 *
 * Shared between `extractToolUIFromText` (render path) and
 * `collectInitialPartIds` (hydration snapshot seeder) so the partIds
 * generated from text-extracted tool UIs match the extractor's output
 * byte-for-byte. Changing this pattern without updating both sites is
 * a bug.
 */
export const JSON_BLOCK_REGEX = /```json\s*\n([\s\S]*?)\n\s*```/g

/**
 * Build the set of stable partIds that will be produced when rendering
 * a single message. Covers both regular tool parts (`toolCallId`) and
 * tool UIs extracted from text parts (`${message.id}-extract-${match.index}`).
 *
 * The text-extracted branch intentionally does NOT parse JSON or test
 * the schema — over-counting is harmless (an unused ID never gets
 * looked up by `useIsNewPart`), but the IDs MUST match what the
 * extractor produces for blocks that do render.
 */
export function collectMessagePartIds(message: UIMessage): string[] {
  const ids: string[] = []

  for (const part of message.parts ?? []) {
    const toolCallId = (part as { toolCallId?: unknown }).toolCallId
    if (typeof toolCallId === 'string') {
      ids.push(toolCallId)
    }

    if (part.type === 'text') {
      const text = (part as { text?: unknown }).text
      if (typeof text !== 'string' || text.length === 0) continue

      // Reset lastIndex — the regex has the /g flag and is module-scoped.
      JSON_BLOCK_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = JSON_BLOCK_REGEX.exec(text)) !== null) {
        ids.push(`${message.id}-extract-${match.index}`)
      }
    }
  }

  return ids
}

/**
 * Collect partIds across a batch of messages. Used to seed the
 * hydration animation snapshot so rehydrated historical chats don't
 * flash entrance animations.
 */
export function collectInitialPartIds(messages: UIMessage[]): string[] {
  const ids: string[] = []
  for (const msg of messages) {
    ids.push(...collectMessagePartIds(msg))
  }
  return ids
}
