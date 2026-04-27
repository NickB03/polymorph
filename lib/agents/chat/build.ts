import {
  ARTIFACT_INTAKE_PROTOCOL,
  CHAT_MODE_PROMPT
} from '@/lib/agents/prompts/search-mode-prompts'

import {
  type ChatAgentDefinition,
  type CreateChatAgentArgs,
  createConfiguredChatAgent
} from './factory'
import {
  SEARCH_AGENT_ACTIVE_TOOLS,
  wrapSearchToolForChatMode,
  wrapSearchToolWithPacing
} from './search'

function isEvalMode(experimentalContext: unknown): boolean {
  return (
    typeof experimentalContext === 'object' &&
    experimentalContext !== null &&
    (experimentalContext as Record<string, unknown>).executionMode === 'eval'
  )
}

export function createBuildAgentDefinition({
  experimentalContext
}: Pick<CreateChatAgentArgs, 'experimentalContext'> = {}): ChatAgentDefinition {
  return {
    agentId: 'build',
    systemPrompt: isEvalMode(experimentalContext)
      ? CHAT_MODE_PROMPT
      : `${ARTIFACT_INTAKE_PROTOCOL}${CHAT_MODE_PROMPT}`,
    activeTools: SEARCH_AGENT_ACTIVE_TOOLS,
    maxSteps: 20,
    configureSearchTool: originalTool =>
      wrapSearchToolWithPacing(wrapSearchToolForChatMode(originalTool))
  }
}

export function createBuildAgent(args: CreateChatAgentArgs) {
  return createConfiguredChatAgent(args, createBuildAgentDefinition(args))
}
