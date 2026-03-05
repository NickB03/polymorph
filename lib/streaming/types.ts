import { UIMessage } from '@ai-sdk/react'

import { ModelType } from '../types/model-type'
import { Model } from '../types/models'
import { SearchMode } from '../types/search'

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
  messages?: UIMessage[] // For tool-result continuations (bypass prepareMessages)
}
