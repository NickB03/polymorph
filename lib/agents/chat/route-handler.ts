import {
  createChatAgentById,
  resolveChatAgentId
} from '@/lib/agents/chat/registry'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'
import type { ChatStreamAgentFactory } from '@/lib/streaming/types'
import type { UIMessage } from '@/lib/types/ai'
import type { ModelType } from '@/lib/types/model-type'
import type { Model } from '@/lib/types/models'
import type { SearchMode, UserMode } from '@/lib/types/search'

import type { CreateChatAgentArgs } from './factory'

type ChatRouteTrigger = 'submit-message' | 'regenerate-message'

type BaseValidatedRouteContext = {
  messages: UIMessage[]
  model: Model
  chatId: string
  trigger?: ChatRouteTrigger
  messageId?: string
  abortSignal?: AbortSignal
  isNewChat?: boolean
  searchMode?: SearchMode
  userMode?: UserMode
  intent?: string
  modelType?: ModelType
}

type AuthenticatedRouteContext = BaseValidatedRouteContext & {
  isGuest: false
  userId: string
}

type GuestRouteContext = BaseValidatedRouteContext & {
  isGuest: true
  userId?: undefined
  guestCanvasToken?: string
}

export type ValidatedChatAgentRouteContext =
  | AuthenticatedRouteContext
  | GuestRouteContext

function createRouteAgentFactory({
  model,
  searchMode,
  userMode,
  intent,
  modelType
}: Pick<
  CreateChatAgentArgs,
  'searchMode' | 'userMode' | 'intent' | 'modelType'
> & {
  model: Model
}): ChatStreamAgentFactory {
  const agentId = resolveChatAgentId({ searchMode, userMode, intent })

  return ({
    modelId,
    writer,
    correlationId,
    otelTraceId,
    canvasToolContext,
    imageToolContext
  }) =>
    createChatAgentById(agentId, {
      model: modelId,
      modelConfig: model,
      writer,
      correlationId,
      otelTraceId,
      searchMode,
      userMode,
      intent,
      modelType,
      canvasToolContext,
      imageToolContext
    })
}

export async function handleChatAgentRoute(
  context: ValidatedChatAgentRouteContext
): Promise<Response> {
  const agentFactory = createRouteAgentFactory({
    model: context.model,
    searchMode: context.searchMode,
    userMode: context.userMode,
    intent: context.intent,
    modelType: context.modelType
  })

  if (context.isGuest) {
    return createEphemeralChatStreamResponse({
      messages: context.messages,
      model: context.model,
      abortSignal: context.abortSignal,
      searchMode: context.searchMode,
      userMode: context.userMode,
      intent: context.intent,
      modelType: context.modelType,
      chatId: context.chatId,
      trigger: context.trigger,
      guestCanvasToken: context.guestCanvasToken,
      agentFactory
    })
  }

  return createChatStreamResponse({
    messages: context.messages,
    model: context.model,
    chatId: context.chatId,
    userId: context.userId,
    trigger: context.trigger,
    messageId: context.messageId,
    abortSignal: context.abortSignal,
    isNewChat: context.isNewChat,
    searchMode: context.searchMode,
    userMode: context.userMode,
    intent: context.intent,
    modelType: context.modelType,
    agentFactory
  })
}
