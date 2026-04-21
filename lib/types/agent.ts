import type {
  InferAgentUIMessage,
  InferUITools,
  ToolLoopAgent,
  UIMessage,
  UIToolInvocation
} from 'ai'

import type { createCanvasArtifactTool } from '../tools/create-canvas-artifact'
import type { displayCalloutTool } from '../tools/display-callout'
import type { displayChartTool } from '../tools/display-chart'
import type { displayCitationsTool } from '../tools/display-citations'
import type { displayGeoMapTool } from '../tools/display-geo-map'
import type { displayLinkPreviewTool } from '../tools/display-link-preview'
import type { displayOptionListTool } from '../tools/display-option-list'
import type { displayPlanTool } from '../tools/display-plan'
import type { displayQuestionWizardTool } from '../tools/display-question-wizard'
import type { displayTableTool } from '../tools/display-table'
import type { displayTimelineTool } from '../tools/display-timeline'
import type { fetchTool } from '../tools/fetch'
import type { createGenerateImageTool } from '../tools/generate-image'
import type { readCanvasArtifactTool } from '../tools/read-canvas-artifact'
import type { createSearchTool } from '../tools/search'
import type { createTodoTools } from '../tools/todo'
import type { updateCanvasArtifactTool } from '../tools/update-canvas-artifact'

// Define the tools type for researcher agent
export type ResearcherTools = {
  search: ReturnType<typeof createSearchTool>
  fetch: typeof fetchTool
  displayPlan: typeof displayPlanTool
  displayTable: typeof displayTableTool
  displayChart: typeof displayChartTool
  displayGeoMap: typeof displayGeoMapTool
  displayCitations: typeof displayCitationsTool
  displayLinkPreview: typeof displayLinkPreviewTool
  displayOptionList: typeof displayOptionListTool
  displayQuestionWizard: typeof displayQuestionWizardTool
  displayCallout: typeof displayCalloutTool
  displayTimeline: typeof displayTimelineTool
  createCanvasArtifact: ReturnType<typeof createCanvasArtifactTool>
  updateCanvasArtifact: ReturnType<typeof updateCanvasArtifactTool>
  readCanvasArtifact: ReturnType<typeof readCanvasArtifactTool>
  generateImage: ReturnType<typeof createGenerateImageTool>
} & ReturnType<typeof createTodoTools>

// Type alias for the researcher agent using ToolLoopAgent
// ToolLoopAgent generic signature is <CALL_OPTIONS, TOOLS, OUTPUT>
export type ResearcherAgent = ToolLoopAgent<never, ResearcherTools, never>

// Infer UI message type for researcher agent
export type ResearcherUIMessage = InferAgentUIMessage<ResearcherAgent>

// Infer UI tools type for researcher agent
export type ResearcherUITools = InferUITools<ResearcherTools>

// Tool invocation types for each tool
export type SearchToolInvocation = UIToolInvocation<ResearcherTools['search']>
export type FetchToolInvocation = UIToolInvocation<ResearcherTools['fetch']>
export type TodoWriteToolInvocation = UIToolInvocation<
  ResearcherTools['todoWrite']
>
export type DisplayPlanToolInvocation = UIToolInvocation<
  ResearcherTools['displayPlan']
>
export type DisplayTableToolInvocation = UIToolInvocation<
  ResearcherTools['displayTable']
>
export type DisplayChartToolInvocation = UIToolInvocation<
  ResearcherTools['displayChart']
>
export type DisplayGeoMapToolInvocation = UIToolInvocation<
  ResearcherTools['displayGeoMap']
>
export type DisplayCitationsToolInvocation = UIToolInvocation<
  ResearcherTools['displayCitations']
>
export type DisplayLinkPreviewToolInvocation = UIToolInvocation<
  ResearcherTools['displayLinkPreview']
>
export type DisplayOptionListToolInvocation = UIToolInvocation<
  ResearcherTools['displayOptionList']
>
export type DisplayQuestionWizardToolInvocation = UIToolInvocation<
  ResearcherTools['displayQuestionWizard']
>
export type DisplayCalloutToolInvocation = UIToolInvocation<
  ResearcherTools['displayCallout']
>
export type DisplayTimelineToolInvocation = UIToolInvocation<
  ResearcherTools['displayTimeline']
>
export type CreateCanvasArtifactToolInvocation = UIToolInvocation<
  ResearcherTools['createCanvasArtifact']
>
export type UpdateCanvasArtifactToolInvocation = UIToolInvocation<
  ResearcherTools['updateCanvasArtifact']
>
export type ReadCanvasArtifactToolInvocation = UIToolInvocation<
  ResearcherTools['readCanvasArtifact']
>
export type GenerateImageToolInvocation = UIToolInvocation<
  ResearcherTools['generateImage']
>

// Union type for all tool invocations
export type ResearcherToolInvocation =
  | SearchToolInvocation
  | FetchToolInvocation
  | TodoWriteToolInvocation
  | DisplayPlanToolInvocation
  | DisplayTableToolInvocation
  | DisplayChartToolInvocation
  | DisplayGeoMapToolInvocation
  | DisplayCitationsToolInvocation
  | DisplayLinkPreviewToolInvocation
  | DisplayOptionListToolInvocation
  | DisplayQuestionWizardToolInvocation
  | DisplayCalloutToolInvocation
  | DisplayTimelineToolInvocation
  | CreateCanvasArtifactToolInvocation
  | UpdateCanvasArtifactToolInvocation
  | ReadCanvasArtifactToolInvocation
  | GenerateImageToolInvocation

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
