import type { UIMessageStreamWriter } from 'ai'

import type { ChatAgent } from '@/lib/agents/chat/factory'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { UIMessage } from '@/lib/types/ai'

import { ModelType } from '../types/model-type'
import { Model } from '../types/models'
import { SearchMode, UserMode } from '../types/search'

import type { ToolResultDelta } from './helpers/prepare-tool-result-messages'

export type ChatStreamAgentFactoryArgs = {
  modelId: string
  writer?: UIMessageStreamWriter
  parentTraceId?: string
  canvasToolContext?: CanvasToolContext
  imageToolContext?: { userId: string; chatId: string }
}

export type ChatStreamAgentFactory = (
  args: ChatStreamAgentFactoryArgs
) => ChatAgent

export interface BaseStreamConfig {
  message: UIMessage | null
  messages?: UIMessage[]
  model: Model
  chatId: string
  userId: string
  trigger?: 'submit-message' | 'regenerate-message' | 'tool-result'
  messageId?: string
  abortSignal?: AbortSignal
  isNewChat?: boolean
  searchMode?: SearchMode
  userMode?: UserMode
  intent?: string
  modelType?: ModelType
  toolResult?: ToolResultDelta
  agentFactory: ChatStreamAgentFactory
}
