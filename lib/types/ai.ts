import type { ReasoningPart, TextPart } from '@ai-sdk/provider-utils'
import type {
  InferUITool,
  UIDataTypes as AIUIDataTypes,
  UIMessage as AIMessage,
  UITools as AIUITools
} from 'ai'

import { fetchTool } from '@/lib/tools/fetch'
import { searchTool } from '@/lib/tools/search'
import { createTodoTools, type TodoItem } from '@/lib/tools/todo'
import type {
  ArtifactData,
  ArtifactEventData,
  ArtifactLogData,
  ArtifactStatusData
} from '@/lib/types/artifact'
import type { ModelType } from '@/lib/types/model-type'
import type { SearchMode } from '@/lib/types/search'

// Re-export TodoItem for external use
export type { TodoItem }

// Define metadata type for messages
export interface UIMessageMetadata {
  traceId?: string
  feedbackScore?: number | null
  searchMode?: SearchMode
  modelType?: ModelType
  modelId?: string
  [key: string]: any
}

export type UIMessage<
  TMetadata = UIMessageMetadata,
  TDataTypes extends AIUIDataTypes = UIDataTypes,
  TTools extends AIUITools = UITools
> = AIMessage<TMetadata, TDataTypes, TTools>

export interface ChatSection {
  id: string
  userMessage: UIMessage
  assistantMessages: UIMessage[]
}

export interface RelatedQuestionsData {
  status: 'loading' | 'streaming' | 'success' | 'error'
  questions?: Array<{ question: string }>
}

export type UIDataTypes = {
  artifact?: ArtifactData
  artifactEvent?: ArtifactEventData
  artifactLog?: ArtifactLogData
  artifactStatus?: ArtifactStatusData
  sources?: any[]
  relatedQuestions?: RelatedQuestionsData
}

// Data part types for DataSection
export type DataArtifactPart = {
  type: 'data-artifact'
  id?: string
  data: ArtifactData
}

export type DataArtifactStatusPart = {
  type: 'data-artifactStatus'
  id?: string
  data: ArtifactStatusData
}

export type DataArtifactLogPart = {
  type: 'data-artifactLog'
  id?: string
  data: ArtifactLogData
}

export type DataArtifactEventPart = {
  type: 'data-artifactEvent'
  id?: string
  data: ArtifactEventData
}

export type DataRelatedQuestionsPart = {
  type: 'data-relatedQuestions'
  id?: string
  data: RelatedQuestionsData
}

export type DataPart =
  | DataArtifactPart
  | DataArtifactStatusPart
  | DataArtifactLogPart
  | DataArtifactEventPart
  | DataRelatedQuestionsPart

// Create todo tools instance for type inference
const todoTools = createTodoTools()

export type UITools = {
  search: InferUITool<typeof searchTool>
  fetch: InferUITool<typeof fetchTool>
  todoWrite: InferUITool<typeof todoTools.todoWrite>
  // Dynamic tools will be added at runtime
  [key: string]: any
}

export type ToolPart<T extends keyof UITools = keyof UITools> = {
  type: `tool-${T}`
  toolCallId: string
  input: UITools[T]['input']
  output?: UITools[T]['output']
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
  errorText?: string
}

export type Part = DataPart | TextPart | ReasoningPart | ToolPart
