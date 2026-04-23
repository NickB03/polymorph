import { type InferAgentUIMessage, type InferUITools, ToolLoopAgent } from 'ai'

import { createResearcher } from '@/lib/agents/researcher'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { ModelType } from '@/lib/types/model-type'
import type { Model } from '@/lib/types/models'
import type { SearchMode } from '@/lib/types/search'

import {
  type ChatAgentTools,
  createChatAgentTools,
  createChatAgentValidationTools} from './toolset'

export type ChatAgent = ToolLoopAgent<never, ChatAgentTools, never>

export type ChatAgentUIMessage = InferAgentUIMessage<ChatAgent>
export type ChatAgentUITools = InferUITools<ChatAgentTools>

export function createChatAgent(args: {
  model: string
  modelConfig?: Model
  searchMode?: SearchMode
  intent?: string
  modelType?: ModelType
  telemetryEnabled?: boolean
  experimentalContext?: unknown
  canvasToolContext?: CanvasToolContext
  imageToolContext?: { userId: string; chatId: string }
}) {
  return createResearcher(args)
}

export { createChatAgentTools, createChatAgentValidationTools }
