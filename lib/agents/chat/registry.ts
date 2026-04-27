import { createBuildAgent } from './build'
import { type ChatAgentId, type CreateChatAgentArgs } from './factory'
import { createResearchAgent } from './research'
import { createSearchAgent } from './search'

type ChatAgentSelection = Pick<
  CreateChatAgentArgs,
  'userMode' | 'searchMode' | 'intent'
>

export function resolveChatAgentId({
  userMode,
  searchMode,
  intent
}: ChatAgentSelection): ChatAgentId {
  if (userMode === 'build' || intent === 'build') return 'build'
  if (userMode === 'search' || searchMode === 'chat') return 'search'
  return 'research'
}

export function createChatAgentById(
  agentId: ChatAgentId,
  args: CreateChatAgentArgs
) {
  switch (agentId) {
    case 'build':
      return createBuildAgent(args)
    case 'research':
      return createResearchAgent(args)
    case 'search':
      return createSearchAgent(args)
  }
}

export function createChatAgent(args: CreateChatAgentArgs) {
  return createChatAgentById(resolveChatAgentId(args), args)
}

export type { ChatAgentId, CreateChatAgentArgs }
