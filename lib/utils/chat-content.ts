import type { UIMessage } from '@/lib/types/ai'

type MessagePart = NonNullable<UIMessage['parts']>[number]

const HIDDEN_PART_TYPES = new Set([
  'data-canvasArtifactStatus',
  'data-canvasArtifactEvent',
  'data-canvasDiagnostics',
  'step-start'
])

export function hasRenderableMessagePart(part: MessagePart): boolean {
  if (!part || typeof part.type !== 'string') return false

  if (HIDDEN_PART_TYPES.has(part.type)) {
    return false
  }

  if (part.type === 'text') {
    return typeof part.text === 'string' && part.text.trim().length > 0
  }

  if (part.type === 'reasoning') {
    return (
      ('text' in part &&
        typeof part.text === 'string' &&
        part.text.trim().length > 0) ||
      ('details' in part &&
        Array.isArray(part.details) &&
        part.details.length > 0)
    )
  }

  return true
}

export function hasRenderableConversationContent(
  messages: UIMessage[]
): boolean {
  return messages.some(message =>
    message.parts?.some(part => hasRenderableMessagePart(part))
  )
}
