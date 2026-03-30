import {
  stepCountIs,
  tool,
  ToolLoopAgent,
  type UIMessageStreamWriter
} from 'ai'

import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { ResearcherTools } from '@/lib/types/agent'
import { type ModelType } from '@/lib/types/model-type'
import { type Model } from '@/lib/types/models'

import { createCanvasArtifactTool } from '../tools/create-canvas-artifact'
import { displayCalloutTool } from '../tools/display-callout'
import { displayChartTool } from '../tools/display-chart'
import { displayCitationsTool } from '../tools/display-citations'
import { displayLinkPreviewTool } from '../tools/display-link-preview'
import { displayOptionListTool } from '../tools/display-option-list'
import { displayPlanTool } from '../tools/display-plan'
import { displayQuestionWizardTool } from '../tools/display-question-wizard'
import { displayTableTool } from '../tools/display-table'
import { displayTimelineTool } from '../tools/display-timeline'
import { fetchTool } from '../tools/fetch'
import { readCanvasArtifactTool } from '../tools/read-canvas-artifact'
import { createSearchTool } from '../tools/search'
import { createTodoTools } from '../tools/todo'
import { updateCanvasArtifactTool } from '../tools/update-canvas-artifact'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

import {
  CHAT_MODE_PROMPT,
  RESEARCH_MODE_PROMPT
} from './prompts/search-mode-prompts'

// Enhanced wrapper function with better type safety and streaming support
function wrapSearchToolForChatMode<
  T extends ReturnType<typeof createSearchTool>
>(originalTool: T): T {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    async *execute(params, context) {
      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }

      // Force optimized type for chat mode
      const modifiedParams = {
        ...params,
        type: 'optimized' as const
      }

      // Execute the original tool and pass through all yielded values
      const result = executeFunc(modifiedParams, context)

      // Handle AsyncIterable (streaming) case
      if (
        result &&
        typeof result === 'object' &&
        Symbol.asyncIterator in result
      ) {
        for await (const chunk of result) {
          yield chunk
        }
      } else {
        // Fallback for non-streaming (shouldn't happen with new implementation)
        const finalResult = await result
        yield finalResult || {
          state: 'complete' as const,
          results: [],
          images: [],
          query: params.query,
          number_of_results: 0
        }
      }
    }
  }) as T
}

// Enhanced researcher function with improved type safety using ToolLoopAgent
// Note: abortSignal should be passed to agent.stream() or agent.generate() calls, not to the agent constructor
export function createResearcher({
  model,
  modelConfig,
  writer,
  parentTraceId,
  searchMode = 'research',
  modelType,
  experimentalContext,
  canvasToolContext
}: {
  model: string
  modelConfig?: Model
  writer?: UIMessageStreamWriter
  parentTraceId?: string
  searchMode?: SearchMode
  modelType?: ModelType
  experimentalContext?: unknown
  canvasToolContext?: CanvasToolContext
}) {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools with proper typing
    const originalSearchTool = createSearchTool(model)
    const todoTools = writer ? createTodoTools() : {}

    let instructions: string
    let systemPrompt: string
    let activeToolsList: (keyof ResearcherTools)[] = []
    let maxSteps: number
    let searchTool = originalSearchTool

    // Configure based on search mode
    switch (searchMode) {
      case 'chat':
        systemPrompt = CHAT_MODE_PROMPT
        activeToolsList = [
          'search',
          'fetch',
          'displayPlan',
          'displayTable',
          'displayChart',
          'displayCitations',
          'displayLinkPreview',
          'displayOptionList',
          'displayQuestionWizard',
          'displayCallout',
          'displayTimeline'
        ]
        maxSteps = 20
        searchTool = wrapSearchToolForChatMode(originalSearchTool)
        console.log(
          `[Researcher] Chat mode: maxSteps=${maxSteps}, tools=[${activeToolsList.join(', ')}]`
        )
        break

      case 'research':
      default:
        systemPrompt = RESEARCH_MODE_PROMPT
        activeToolsList = [
          'search',
          'fetch',
          'displayTable',
          'displayChart',
          'displayCitations',
          'displayLinkPreview',
          'displayOptionList',
          'displayQuestionWizard',
          'displayCallout',
          'displayTimeline'
        ]
        // Enable todo tools when writer is available
        if (writer && 'todoWrite' in todoTools) {
          activeToolsList.push('todoWrite')
        }
        console.log(
          `[Researcher] Research mode: maxSteps=50, modelType=${modelType}, tools=[${activeToolsList.join(', ')}]`
        )
        maxSteps = 50
        searchTool = originalSearchTool
        break
    }

    instructions = `${systemPrompt}\nCurrent date and time: ${currentDate}`

    if (canvasToolContext?.currentArtifact) {
      instructions += `\n\nCurrent canvas artifact state:\n- artifactId: ${canvasToolContext.currentArtifact.artifactId}\n- baseRevision: ${canvasToolContext.currentArtifact.draftRevision}\nIf the artifact source code is not in the conversation above, call readCanvasArtifact to fetch the latest source before updating.`
    }

    // Build canvas tools when context is available
    const canvasTools = canvasToolContext
      ? {
          createCanvasArtifact: createCanvasArtifactTool(canvasToolContext),
          updateCanvasArtifact: updateCanvasArtifactTool(canvasToolContext),
          readCanvasArtifact: readCanvasArtifactTool(canvasToolContext)
        }
      : {}

    if (canvasToolContext) {
      activeToolsList.push(
        'createCanvasArtifact' as keyof ResearcherTools,
        'updateCanvasArtifact' as keyof ResearcherTools,
        'readCanvasArtifact' as keyof ResearcherTools
      )
    }

    // Build tools object with proper typing
    const tools: ResearcherTools = {
      search: searchTool,
      fetch: fetchTool,
      displayPlan: displayPlanTool,
      displayTable: displayTableTool,
      displayChart: displayChartTool,
      displayCitations: displayCitationsTool,
      displayLinkPreview: displayLinkPreviewTool,
      displayOptionList: displayOptionListTool,
      displayQuestionWizard: displayQuestionWizardTool,
      displayCallout: displayCalloutTool,
      displayTimeline: displayTimelineTool,
      ...todoTools,
      ...canvasTools
    } as ResearcherTools

    // Create ToolLoopAgent with all configuration
    const agent = new ToolLoopAgent({
      model: getModel(model),
      instructions,
      tools,
      activeTools: activeToolsList,
      stopWhen: stepCountIs(maxSteps),
      ...(modelConfig?.providerOptions && {
        providerOptions: modelConfig.providerOptions
      }),
      ...(experimentalContext !== undefined && {
        experimental_context: experimentalContext
      }),
      experimental_telemetry: {
        isEnabled: isTracingEnabled(),
        functionId: 'research-agent',
        metadata: {
          modelId: model,
          agentType: 'researcher',
          searchMode,
          ...(parentTraceId && {
            langfuseTraceId: parentTraceId,
            langfuseUpdateParent: false
          })
        }
      }
    })

    return agent
  } catch (error) {
    console.error('Error in createResearcher:', error)
    throw error
  }
}

// Helper function to access agent tools
export function getResearcherTools(
  agent: ToolLoopAgent<never, ResearcherTools, never>
): ResearcherTools {
  return agent.tools
}

// Export the legacy function name for backward compatibility
export const researcher = createResearcher
