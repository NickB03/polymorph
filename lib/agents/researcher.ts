import {
  type ChatAgent,
  type CreateChatAgentArgs
} from '@/lib/agents/chat/factory'
import { createChatAgent } from '@/lib/agents/chat/registry'

export function createResearcher(args: CreateChatAgentArgs): ChatAgent {
  return createChatAgent(args)
}

export function getResearcherTools(agent: ChatAgent) {
  return agent.tools
}

export const researcher = createResearcher
