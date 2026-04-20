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
  CanvasArtifactStatus,
  CanvasCompileProgressPayload,
  CanvasDiagnostic
} from '@/lib/types/canvas'
import type { ModelType } from '@/lib/types/model-type'
import type { UserMode } from '@/lib/types/search'

// Re-export TodoItem for external use
export type { TodoItem }

// Define metadata type for messages
export interface UIMessageMetadata {
  traceId?: string
  feedbackScore?: number | null
  userMode?: UserMode
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

// ── Canvas data part payloads ────────────────────────────────────────

export type CanvasArtifactData = {
  artifactId: string
  chatId: string
  title: string
  status: CanvasArtifactStatus
  draftRevision: number
  currentVersionId: string | null
}

export type CanvasArtifactStatusData = {
  artifactId: string
  chatId: string
  status: CanvasArtifactStatus
  draftRevision: number
  currentVersionId: string | null
  updatedAt: string
  guestCanvasToken?: string
}

export type CanvasArtifactEventData = {
  artifactId: string
  event: 'compile-progress'
  payload: CanvasCompileProgressPayload
}

export type CanvasDiagnosticsData = {
  artifactId: string
  diagnostics: CanvasDiagnostic[]
}

// ── UIDataTypes (drives the generic stream writer) ───────────────────

export type UIDataTypes = {
  sources?: any[]
  relatedQuestions?: RelatedQuestionsData
  canvasArtifact?: CanvasArtifactData
  canvasArtifactStatus?: CanvasArtifactStatusData
  canvasArtifactEvent?: CanvasArtifactEventData
  canvasDiagnostics?: CanvasDiagnosticsData
}

// ── Concrete data part types ─────────────────────────────────────────

export type DataRelatedQuestionsPart = {
  type: 'data-relatedQuestions'
  id?: string
  data: RelatedQuestionsData
}

export type DataCanvasArtifactPart = {
  type: 'data-canvasArtifact'
  id?: string
  data: CanvasArtifactData
}

export type DataCanvasArtifactStatusPart = {
  type: 'data-canvasArtifactStatus'
  id?: string
  data: CanvasArtifactStatusData
}

/** Transient — not persisted to the database. */
export type DataCanvasArtifactEventPart = {
  type: 'data-canvasArtifactEvent'
  id?: string
  data: CanvasArtifactEventData
  transient: true
}

/** Transient — not persisted to the database. */
export type DataCanvasDiagnosticsPart = {
  type: 'data-canvasDiagnostics'
  id?: string
  data: CanvasDiagnosticsData
  transient: true
}

export type DataPart =
  | DataRelatedQuestionsPart
  | DataCanvasArtifactPart
  | DataCanvasArtifactStatusPart
  | DataCanvasArtifactEventPart
  | DataCanvasDiagnosticsPart

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
