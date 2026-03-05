import type { Chat, Message } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

export interface StreamContext {
  chatId: string
  userId: string
  modelId: string
  messageId?: string
  trigger?: 'submit-message' | 'regenerate-message' | 'tool-result'
  initialChat: (Chat & { messages: UIMessage[] }) | null
  abortSignal?: AbortSignal
  parentTraceId?: string
  isNewChat?: boolean
  pendingInitialSave?: Promise<{ chat: Chat; message: Message }>
  pendingInitialUserMessage?: UIMessage
}
