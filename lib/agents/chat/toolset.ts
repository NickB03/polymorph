import type { UIMessageStreamWriter } from 'ai'

import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import { serverTool as createCanvasArtifactTool } from '@/lib/tools/create-canvas-artifact/server'
import { fetchTool } from '@/lib/tools/fetch/server'
import { serverTool as createGenerateImageTool } from '@/lib/tools/generate-image/server'
import { geocodeAddressTool } from '@/lib/tools/geocode-address'
import { getDirectionsTool } from '@/lib/tools/get-directions'
import { getIsochroneTool } from '@/lib/tools/get-isochrone'
import { getStaticMapImageTool } from '@/lib/tools/get-static-map-image'
import { serverTool as readCanvasArtifactTool } from '@/lib/tools/read-canvas-artifact/server'
import { createSearchTool } from '@/lib/tools/search/server'
import { createTodoTools } from '@/lib/tools/todo'
import {
  createToolUiServerTools,
  type ToolUiServerTools
} from '@/lib/tools/tool-ui/server-catalog'
import { serverTool as updateCanvasArtifactTool } from '@/lib/tools/update-canvas-artifact/server'

import { createCompetitorResearchTool } from './specialists/competitor-research'

type ImageToolContext = { userId: string; chatId: string; isGuest?: boolean }

export type ChatAgentTools = {
  search: ReturnType<typeof createSearchTool>
  fetch: typeof fetchTool
  getDirections: typeof getDirectionsTool
  geocodeAddress: typeof geocodeAddressTool
  getIsochrone: typeof getIsochroneTool
  getStaticMapImage: typeof getStaticMapImageTool
  createCanvasArtifact: ReturnType<typeof createCanvasArtifactTool>
  updateCanvasArtifact: ReturnType<typeof updateCanvasArtifactTool>
  readCanvasArtifact: ReturnType<typeof readCanvasArtifactTool>
  generateImage: ReturnType<typeof createGenerateImageTool>
  competitorResearch: ReturnType<typeof createCompetitorResearchTool>
} & ToolUiServerTools &
  ReturnType<typeof createTodoTools>

type CreateChatAgentToolsArgs = {
  model: string
  writer?: UIMessageStreamWriter
  canvasToolContext?: CanvasToolContext
  imageToolContext?: ImageToolContext
  searchTool?: ReturnType<typeof createSearchTool>
}

function createNoopCanvasToolContext(): CanvasToolContext {
  return {
    chatId: 'validation-chat',
    userId: 'validation-user',
    isGuest: false,
    emitter: {
      emitCanvasArtifact: () => {},
      emitCanvasArtifactStatus: () => {},
      emitCanvasArtifactEvent: () => {},
      emitCanvasDiagnostics: () => {}
    }
  }
}

export function createChatAgentTools({
  model,
  writer: _writer,
  canvasToolContext,
  imageToolContext,
  searchTool
}: CreateChatAgentToolsArgs): ChatAgentTools {
  const todoTools = createTodoTools()
  const toolUiTools = createToolUiServerTools()
  const activeSearchTool = searchTool ?? createSearchTool(model)
  const competitorResearchTool = createCompetitorResearchTool({
    searchTool: activeSearchTool,
    fetchTool
  })
  const canvasTools = canvasToolContext
    ? {
        createCanvasArtifact: createCanvasArtifactTool(canvasToolContext),
        updateCanvasArtifact: updateCanvasArtifactTool(canvasToolContext),
        readCanvasArtifact: readCanvasArtifactTool(canvasToolContext)
      }
    : {}

  const imageTools = imageToolContext
    ? {
        generateImage: createGenerateImageTool(imageToolContext)
      }
    : {}

  return {
    search: activeSearchTool,
    fetch: fetchTool,
    competitorResearch: competitorResearchTool,
    getDirections: getDirectionsTool,
    geocodeAddress: geocodeAddressTool,
    getIsochrone: getIsochroneTool,
    getStaticMapImage: getStaticMapImageTool,
    ...toolUiTools,
    ...todoTools,
    ...canvasTools,
    ...imageTools
  } as ChatAgentTools
}

export function createChatAgentValidationTools(model: string): ChatAgentTools {
  return createChatAgentTools({
    model,
    canvasToolContext: createNoopCanvasToolContext(),
    imageToolContext: {
      userId: 'validation-user',
      chatId: 'validation-chat'
    }
  })
}
