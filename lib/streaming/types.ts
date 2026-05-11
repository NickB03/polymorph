import type { UIMessageStreamWriter } from 'ai'

import type { ChatAgent } from '@/lib/agents/chat/factory'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { UIMessage } from '@/lib/types/ai'

import { ModelType } from '../types/model-type'
import { Model } from '../types/models'
import { SearchMode, UserMode } from '../types/search'

export type ChatStreamAgentFactoryArgs = {
  modelId: string
  writer?: UIMessageStreamWriter
  correlationId?: string
  otelTraceId?: string
  canvasToolContext?: CanvasToolContext
  imageToolContext?: { userId: string; chatId: string }
}

export type ChatStreamAgentFactory = (
  args: ChatStreamAgentFactoryArgs
) => ChatAgent

export interface BaseStreamConfig {
  messages: UIMessage[]
  model: Model
  chatId: string
  userId: string
  trigger?: 'submit-message' | 'regenerate-message'
  messageId?: string
  abortSignal?: AbortSignal
  isNewChat?: boolean
  searchMode?: SearchMode
  userMode?: UserMode
  intent?: string
  modelType?: ModelType
  agentFactory: ChatStreamAgentFactory
}
