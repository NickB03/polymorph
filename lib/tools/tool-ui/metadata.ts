import type { ToolUiCommunitySourceId } from './community-sources'

export const TOOL_UI_AGENT_MODES = ['search', 'research', 'build'] as const

export type ToolUiAgentMode = (typeof TOOL_UI_AGENT_MODES)[number]

export type ToolUiToolKind = 'passive-display' | 'interactive-display'

export type ToolUiToolMetadata = {
  name: string
  kind: ToolUiToolKind
  activeIn: readonly ToolUiAgentMode[]
  communitySourceId?: ToolUiCommunitySourceId
}

export const TOOL_UI_TOOL_METADATA = [
  {
    name: 'displayPlan',
    kind: 'passive-display',
    activeIn: ['search', 'build']
  },
  {
    name: 'displayTable',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayChart',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayGeoMap',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayCitations',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayLinkPreview',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayAgentArtifact',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build'],
    communitySourceId: 'agent-kit-agent-artifact'
  },
  {
    name: 'displayOptionList',
    kind: 'interactive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayQuestionWizard',
    kind: 'interactive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayCallout',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayTimeline',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  }
] as const satisfies readonly ToolUiToolMetadata[]

export type ToolUiToolName = (typeof TOOL_UI_TOOL_METADATA)[number]['name']

export type InteractiveToolUiToolName = Extract<
  (typeof TOOL_UI_TOOL_METADATA)[number],
  { kind: 'interactive-display' }
>['name']

export type InteractiveToolUiPartType = `tool-${InteractiveToolUiToolName}`

export function getToolUiToolNamesForMode(
  mode: ToolUiAgentMode
): ToolUiToolName[] {
  return TOOL_UI_TOOL_METADATA.filter(tool => {
    const activeIn = tool.activeIn as readonly ToolUiAgentMode[]
    return activeIn.includes(mode)
  }).map(tool => tool.name)
}

export function getInteractiveToolPartTypes(): InteractiveToolUiPartType[] {
  return TOOL_UI_TOOL_METADATA.filter(
    tool => tool.kind === 'interactive-display'
  ).map(tool => `tool-${tool.name}` as InteractiveToolUiPartType)
}

export function getInteractiveToolUiToolNames(): InteractiveToolUiToolName[] {
  return TOOL_UI_TOOL_METADATA.filter(
    tool => tool.kind === 'interactive-display'
  ).map(tool => tool.name as InteractiveToolUiToolName)
}

export const INTERACTIVE_TOOL_PART_TYPES = getInteractiveToolPartTypes()
export const INTERACTIVE_TOOL_UI_TOOL_NAMES = getInteractiveToolUiToolNames()
