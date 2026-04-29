import { stepCountIs, ToolLoopAgent, type UIMessageStreamWriter } from 'ai'

import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import { createSearchTool } from '@/lib/tools/search/server'
import type { ModelType } from '@/lib/types/model-type'
import type { Model } from '@/lib/types/models'
import type { SearchMode, UserMode } from '@/lib/types/search'
import { createModelId } from '@/lib/utils'
import { selectModelForModeAndType } from '@/lib/utils/model-selection'
import { getModel } from '@/lib/utils/registry'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import { type ChatAgentTools, createChatAgentTools } from './toolset'

export type ChatAgentId = 'search' | 'research' | 'build'

export type ChatAgent = ToolLoopAgent<never, ChatAgentTools, never>

export type CreateChatAgentArgs = {
  model: string
  modelConfig?: Model
  searchMode?: SearchMode
  userMode?: UserMode
  intent?: string
  modelType?: ModelType
  writer?: UIMessageStreamWriter
  correlationId?: string
  otelTraceId?: string
  /** Legacy compatibility for call sites that still pass generated trace IDs. */
  parentTraceId?: string
  telemetryEnabled?: boolean
  experimentalContext?: unknown
  canvasToolContext?: CanvasToolContext
  imageToolContext?: { userId: string; chatId: string }
}

export type ChatAgentDefinition = {
  agentId: ChatAgentId
  systemPrompt: string
  activeTools: (keyof ChatAgentTools)[]
  maxSteps: number
  configureSearchTool: (
    originalTool: ReturnType<typeof createSearchTool>
  ) => ReturnType<typeof createSearchTool>
}

const INTERACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'displayOptionList',
  'displayQuestionWizard'
]

export function createConfiguredChatAgent(
  args: CreateChatAgentArgs,
  definition: ChatAgentDefinition
): ChatAgent {
  const {
    writer,
    correlationId,
    otelTraceId,
    parentTraceId,
    searchMode,
    modelType,
    telemetryEnabled,
    experimentalContext,
    canvasToolContext,
    imageToolContext
  } = args
  let model = args.model
  let modelConfig = args.modelConfig

  try {
    const currentDate = new Date().toLocaleString()
    const isEvalMode =
      typeof experimentalContext === 'object' &&
      experimentalContext !== null &&
      (experimentalContext as Record<string, unknown>).executionMode === 'eval'

    let activeTools = [...definition.activeTools]
    let instructions = `${definition.systemPrompt}\nCurrent date and time: ${currentDate}`

    if (canvasToolContext?.currentArtifact) {
      instructions += `\n\nCurrent canvas artifact state:\n- artifactId: ${canvasToolContext.currentArtifact.artifactId}\n- baseRevision: ${canvasToolContext.currentArtifact.draftRevision}\nIf the artifact source code is not in the conversation above, call readCanvasArtifact to fetch the latest source before updating.`
    }

    if (isEvalMode) {
      activeTools = activeTools.filter(
        tool => !INTERACTIVE_TOOLS.includes(tool)
      )
      console.log(
        `[ChatAgent:${definition.agentId}] Eval mode: removed interactive tools, active=[${activeTools.join(', ')}]`
      )
    }

    if (canvasToolContext) {
      if (modelType !== 'quality') {
        const upgraded = selectModelForModeAndType({
          searchMode,
          modelType: 'quality'
        })
        const upgradedId = createModelId(upgraded)
        console.log(
          `[ChatAgent:${definition.agentId}] Canvas active, upgrading model: ${model} → ${upgradedId}`
        )
        model = upgradedId
        modelConfig = upgraded
      }
      activeTools.push(
        'createCanvasArtifact',
        'updateCanvasArtifact',
        'readCanvasArtifact'
      )
    }

    if (imageToolContext) {
      activeTools.push('generateImage')
    }

    const searchTool = definition.configureSearchTool(createSearchTool(model))
    const effectiveCorrelationId = correlationId ?? parentTraceId

    const baseTools = createChatAgentTools({
      model,
      writer,
      canvasToolContext,
      imageToolContext,
      searchTool
    })

    const tools: ChatAgentTools = baseTools

    console.log(
      `[ChatAgent:${definition.agentId}] mode=${searchMode ?? 'default'}, maxSteps=${definition.maxSteps}, modelType=${modelType}, tools=[${activeTools.join(', ')}]`
    )

    return new ToolLoopAgent({
      model: getModel(model),
      instructions,
      tools,
      activeTools,
      stopWhen: stepCountIs(definition.maxSteps),
      ...(modelConfig?.providerOptions && {
        providerOptions: modelConfig.providerOptions
      }),
      ...(experimentalContext !== undefined && {
        experimental_context: experimentalContext
      }),
      experimental_telemetry: {
        isEnabled: telemetryEnabled ?? isTracingEnabled(),
        functionId: `${definition.agentId}-agent`,
        metadata: {
          modelId: model,
          agentType: definition.agentId,
          ...(effectiveCorrelationId
            ? { correlationId: effectiveCorrelationId }
            : {}),
          ...(otelTraceId ? { otelTraceId } : {}),
          ...(searchMode ? { searchMode } : {}),
          ...(args.userMode ? { userMode: args.userMode } : {}),
          ...(args.intent ? { intent: args.intent } : {}),
          ...(modelType ? { modelType } : {})
        }
      }
    })
  } catch (error) {
    console.error(`Error in ${definition.agentId} chat agent:`, error)
    throw error
  }
}
