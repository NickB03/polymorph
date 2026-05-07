import type { Tool } from 'ai'

import { serverTool as displayAgentArtifactTool } from '@/lib/tools/display-agent-artifact/server'
import { serverTool as displayCalloutTool } from '@/lib/tools/display-callout/server'
import { serverTool as displayChartTool } from '@/lib/tools/display-chart/server'
import { serverTool as displayCitationsTool } from '@/lib/tools/display-citations/server'
import { displayGeoMapTool } from '@/lib/tools/display-geo-map'
import { serverTool as displayLinkPreviewTool } from '@/lib/tools/display-link-preview/server'
import { serverTool as displayOptionListTool } from '@/lib/tools/display-option-list/server'
import { serverTool as displayPlanTool } from '@/lib/tools/display-plan/server'
import { serverTool as displayQuestionWizardTool } from '@/lib/tools/display-question-wizard/server'
import { serverTool as displayTableTool } from '@/lib/tools/display-table/server'
import { serverTool as displayTimelineTool } from '@/lib/tools/display-timeline/server'

import type { ToolUiToolName } from './metadata'

const SERVER_TOOLS_BY_NAME = {
  displayPlan: displayPlanTool,
  displayTable: displayTableTool,
  displayChart: displayChartTool,
  displayGeoMap: displayGeoMapTool,
  displayCitations: displayCitationsTool,
  displayLinkPreview: displayLinkPreviewTool,
  displayAgentArtifact: displayAgentArtifactTool,
  displayOptionList: displayOptionListTool,
  displayQuestionWizard: displayQuestionWizardTool,
  displayCallout: displayCalloutTool,
  displayTimeline: displayTimelineTool
} satisfies Record<ToolUiToolName, Tool>

export type ToolUiServerTools = typeof SERVER_TOOLS_BY_NAME

export function createToolUiServerTools(): ToolUiServerTools {
  return SERVER_TOOLS_BY_NAME
}

export function getToolUiServerToolNames(): ToolUiToolName[] {
  return Object.keys(SERVER_TOOLS_BY_NAME) as ToolUiToolName[]
}
