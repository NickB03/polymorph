import { UIMessage } from '@ai-sdk/react'

import { ModelType } from '../types/model-type'
import { Model } from '../types/models'
import { SearchMode } from '../types/search'

import type { ToolResultDelta } from './helpers/prepare-tool-result-messages'

export interface BaseStreamConfig {
  message: UIMessage | null
  model: Model
  chatId: string
  userId: string
  trigger?: 'submit-message' | 'regenerate-message' | 'tool-result'
  messageId?: string
  abortSignal?: AbortSignal
  isNewChat?: boolean
  searchMode?: SearchMode
  modelType?: ModelType
  toolResult?: ToolResultDelta
}
