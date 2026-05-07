import {
  ARTIFACT_INTAKE_PROTOCOL,
  CHAT_MODE_PROMPT
} from '@/lib/agents/prompts/search-mode-prompts'
import { getToolUiToolNamesForMode } from '@/lib/tools/tool-ui/metadata'

import {
  type ChatAgentDefinition,
  type CreateChatAgentArgs,
  createConfiguredChatAgent
} from './factory'
import {
  GEO_UTILITY_TOOLS,
  wrapSearchToolForChatMode,
  wrapSearchToolWithPacing
} from './search'
import type { ChatAgentTools } from './toolset'

function isEvalMode(experimentalContext: unknown): boolean {
  return (
    typeof experimentalContext === 'object' &&
    experimentalContext !== null &&
    (experimentalContext as Record<string, unknown>).executionMode === 'eval'
  )
}

export const BUILD_AGENT_ACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'search',
  'fetch',
  ...getToolUiToolNamesForMode('build'),
  ...GEO_UTILITY_TOOLS
]

export function createBuildAgentDefinition({
  experimentalContext
}: Pick<CreateChatAgentArgs, 'experimentalContext'> = {}): ChatAgentDefinition {
  return {
    agentId: 'build',
    systemPrompt: isEvalMode(experimentalContext)
      ? CHAT_MODE_PROMPT
      : `${ARTIFACT_INTAKE_PROTOCOL}${CHAT_MODE_PROMPT}`,
    activeTools: BUILD_AGENT_ACTIVE_TOOLS,
    maxSteps: 20,
    configureSearchTool: originalTool =>
      wrapSearchToolWithPacing(wrapSearchToolForChatMode(originalTool))
  }
}

export function createBuildAgent(args: CreateChatAgentArgs) {
  return createConfiguredChatAgent(args, createBuildAgentDefinition(args))
}
