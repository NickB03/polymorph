import type { InferUITools, UIMessage } from 'ai'

import type { UIDataTypes, UIMessageMetadata } from '@/lib/types/ai'

import type { ChatAgentTools } from './toolset'

export type ChatAgentUITools = InferUITools<ChatAgentTools>

export type ChatUIMessage = UIMessage<
  UIMessageMetadata,
  UIDataTypes,
  ChatAgentUITools
>
