import { tool } from 'ai'

import { CHAT_MODE_PROMPT } from '@/lib/agents/prompts/search-mode-prompts'
import { createSearchTool } from '@/lib/tools/search/server'

import {
  type ChatAgentDefinition,
  type CreateChatAgentArgs,
  createConfiguredChatAgent
} from './factory'
import type { ChatAgentTools } from './toolset'

export const SEARCH_AGENT_ACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'search',
  'fetch',
  'displayPlan',
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

export function wrapSearchToolWithPacing<
  T extends ReturnType<typeof createSearchTool>
>(originalTool: T, minGapMs: number = 200): T {
  let lastCallTime = 0

  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    async *execute(params, context) {
      const now = Date.now()
      const elapsed = now - lastCallTime
      if (lastCallTime > 0 && elapsed < minGapMs) {
        const waitMs = minGapMs - elapsed
        await new Promise<void>(resolve => {
          if (context?.abortSignal?.aborted) {
            resolve()
            return
          }
          const timer = setTimeout(resolve, waitMs)
          context?.abortSignal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              resolve()
            },
            { once: true }
          )
        })
        if (context?.abortSignal?.aborted) return
      }
      lastCallTime = Date.now()

      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }

      const result = executeFunc(params, context)
      if (
        result &&
        typeof result === 'object' &&
        Symbol.asyncIterator in result
      ) {
        for await (const chunk of result) {
          yield chunk
        }
      } else {
        const finalResult = await result
        yield finalResult || {
          state: 'complete' as const,
          results: [],
          images: [],
          query: params.query,
          number_of_results: 0
        }
      }
    }
  }) as T
}

export function wrapSearchToolForChatMode<
  T extends ReturnType<typeof createSearchTool>
>(originalTool: T): T {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    async *execute(params, context) {
      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }

      const modifiedParams = {
        ...params,
        type: 'optimized' as const
      }

      const result = executeFunc(modifiedParams, context)
      if (
        result &&
        typeof result === 'object' &&
        Symbol.asyncIterator in result
      ) {
        for await (const chunk of result) {
          yield chunk
        }
      } else {
        const finalResult = await result
        yield finalResult || {
          state: 'complete' as const,
          results: [],
          images: [],
          query: params.query,
          number_of_results: 0
        }
      }
    }
  }) as T
}

export function createSearchAgentDefinition(): ChatAgentDefinition {
  return {
    agentId: 'search',
    systemPrompt: CHAT_MODE_PROMPT,
    activeTools: SEARCH_AGENT_ACTIVE_TOOLS,
    maxSteps: 20,
    configureSearchTool: originalTool =>
      wrapSearchToolWithPacing(wrapSearchToolForChatMode(originalTool))
  }
}

export function createSearchAgent(args: CreateChatAgentArgs) {
  return createConfiguredChatAgent(args, createSearchAgentDefinition())
}
