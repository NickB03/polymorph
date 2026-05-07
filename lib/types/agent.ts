import type {
  InferAgentUIMessage,
  InferUITools,
  ToolLoopAgent,
  UIMessage,
  UIToolInvocation
} from 'ai'

import type { ChatAgentTools } from '@/lib/agents/chat/toolset'

// Define the tools type for researcher agent
export type ResearcherTools = ChatAgentTools

// Type alias for the researcher agent using ToolLoopAgent
// ToolLoopAgent generic signature is <CALL_OPTIONS, TOOLS, OUTPUT>
export type ResearcherAgent = ToolLoopAgent<never, ResearcherTools, never>

// Infer UI message type for researcher agent
export type ResearcherUIMessage = InferAgentUIMessage<ResearcherAgent>

// Infer UI tools type for researcher agent
export type ResearcherUITools = InferUITools<ResearcherTools>

type ResearcherToolInvocationMap = {
  [ToolName in keyof ResearcherTools]: UIToolInvocation<
    ResearcherTools[ToolName]
  >
}

// Tool invocation types for each tool
export type SearchToolInvocation = ResearcherToolInvocationMap['search']
export type FetchToolInvocation = ResearcherToolInvocationMap['fetch']
export type TodoWriteToolInvocation = ResearcherToolInvocationMap['todoWrite']
export type DisplayPlanToolInvocation =
  ResearcherToolInvocationMap['displayPlan']
export type DisplayTableToolInvocation =
  ResearcherToolInvocationMap['displayTable']
export type DisplayChartToolInvocation =
  ResearcherToolInvocationMap['displayChart']
export type DisplayGeoMapToolInvocation =
  ResearcherToolInvocationMap['displayGeoMap']
export type GetDirectionsToolInvocation =
  ResearcherToolInvocationMap['getDirections']
export type GeocodeAddressToolInvocation =
  ResearcherToolInvocationMap['geocodeAddress']
export type GetIsochroneToolInvocation =
  ResearcherToolInvocationMap['getIsochrone']
export type GetStaticMapImageToolInvocation =
  ResearcherToolInvocationMap['getStaticMapImage']
export type DisplayCitationsToolInvocation =
  ResearcherToolInvocationMap['displayCitations']
export type DisplayLinkPreviewToolInvocation =
  ResearcherToolInvocationMap['displayLinkPreview']
export type DisplayAgentArtifactToolInvocation =
  ResearcherToolInvocationMap['displayAgentArtifact']
export type DisplayOptionListToolInvocation =
  ResearcherToolInvocationMap['displayOptionList']
export type DisplayQuestionWizardToolInvocation =
  ResearcherToolInvocationMap['displayQuestionWizard']
export type DisplayCalloutToolInvocation =
  ResearcherToolInvocationMap['displayCallout']
export type DisplayTimelineToolInvocation =
  ResearcherToolInvocationMap['displayTimeline']
export type CreateCanvasArtifactToolInvocation =
  ResearcherToolInvocationMap['createCanvasArtifact']
export type UpdateCanvasArtifactToolInvocation =
  ResearcherToolInvocationMap['updateCanvasArtifact']
export type ReadCanvasArtifactToolInvocation =
  ResearcherToolInvocationMap['readCanvasArtifact']
export type GenerateImageToolInvocation =
  ResearcherToolInvocationMap['generateImage']
export type CompetitorResearchToolInvocation =
  ResearcherToolInvocationMap['competitorResearch']

// Union type for all tool invocations
export type ResearcherToolInvocation =
  ResearcherToolInvocationMap[keyof ResearcherToolInvocationMap]

// Helper type to extract tool names
export type ResearcherToolName = keyof ResearcherTools

// Type guard functions
export function isSearchToolInvocation(
  invocation: ResearcherToolInvocation
): invocation is SearchToolInvocation {
  return (
    typeof invocation.input === 'object' &&
    invocation.input !== null &&
    'query' in invocation.input
  )
}

export function isFetchToolInvocation(
  invocation: ResearcherToolInvocation
): invocation is FetchToolInvocation {
  return (
    typeof invocation.input === 'object' &&
    invocation.input !== null &&
    'url' in invocation.input
  )
}

// Response type for agent.respond()
export type ResearcherResponse = Response

// Options type for agent.respond()
export type ResearcherRespondOptions = {
  messages: UIMessage<never, never, ResearcherUITools>[]
}
