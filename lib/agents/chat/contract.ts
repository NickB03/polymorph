import {
  type InferAgentUIMessage,
  type InferUITools,
  ToolLoopAgent,
  type UIMessageStreamWriter
} from 'ai'

import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { ModelType } from '@/lib/types/model-type'
import type { Model } from '@/lib/types/models'
import type { SearchMode, UserMode } from '@/lib/types/search'

import { createChatAgent as createRegisteredChatAgent } from './registry'
import {
  type ChatAgentTools,
  createChatAgentTools,
  createChatAgentValidationTools
} from './toolset'

export type ChatAgent = ToolLoopAgent<never, ChatAgentTools, never>

export type ChatAgentUIMessage = InferAgentUIMessage<ChatAgent>
export type ChatAgentUITools = InferUITools<ChatAgentTools>

export function createChatAgent(args: {
  model: string
  modelConfig?: Model
  searchMode?: SearchMode
  userMode?: UserMode
  intent?: string
  modelType?: ModelType
  writer?: UIMessageStreamWriter
  correlationId?: string
  otelTraceId?: string
  /** Legacy compatibility for older call sites. */
  parentTraceId?: string
  telemetryEnabled?: boolean
  experimentalContext?: unknown
  canvasToolContext?: CanvasToolContext
  imageToolContext?: { userId: string; chatId: string }
}) {
  return createRegisteredChatAgent(args)
}

export { createChatAgentTools, createChatAgentValidationTools }
