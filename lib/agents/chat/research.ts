import { RESEARCH_MODE_PROMPT } from '@/lib/agents/prompts/search-mode-prompts'

import {
  type ChatAgentDefinition,
  type CreateChatAgentArgs,
  createConfiguredChatAgent
} from './factory'
import { wrapSearchToolWithPacing } from './search'
import type { ChatAgentTools } from './toolset'

export const RESEARCH_AGENT_ACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'search',
  'fetch',
  'displayTable',
  'displayChart',
  'displayGeoMap',
  'getDirections',
  'geocodeAddress',
  'getIsochrone',
  'getStaticMapImage',
  'displayCitations',
  'displayLinkPreview',
  'displayOptionList',
  'displayQuestionWizard',
  'displayCallout',
  'displayTimeline'
]

export function createResearchAgentDefinition({
  writer
}: Pick<CreateChatAgentArgs, 'writer'> = {}): ChatAgentDefinition {
  return {
    agentId: 'research',
    systemPrompt: RESEARCH_MODE_PROMPT,
    activeTools: writer
      ? [...RESEARCH_AGENT_ACTIVE_TOOLS, 'todoWrite']
      : RESEARCH_AGENT_ACTIVE_TOOLS,
    maxSteps: 50,
    configureSearchTool: originalTool => wrapSearchToolWithPacing(originalTool)
  }
}

export function createResearchAgent(args: CreateChatAgentArgs) {
  return createConfiguredChatAgent(args, createResearchAgentDefinition(args))
}
