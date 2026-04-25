// Portability pattern: Vercel AI SDK "Tools and Tool Calling" structured `tool({ inputSchema, execute })` pattern.
// Source: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling

import { createElement, Fragment, isValidElement } from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const portabilityMocks = vi.hoisted(() => {
  const searchTool = {
    description: 'mocked search tool',
    inputSchema: {},
    execute: vi.fn(async function* ({ query }: { query: string }) {
      const competitor = query.includes('Alpha') ? 'Alpha' : 'Beta'
      const slug = competitor.toLowerCase()

      yield {
        state: 'complete',
        query,
        results: [
          {
            title: `${competitor} overview`,
            url: `https://example.com/${slug}`,
            content: `${competitor} search evidence highlights onboarding and reliability.`
          }
        ],
        images: []
      }
    })
  }
  const fetchTool = {
    execute: vi.fn(async function* ({ url }: { url: string }) {
      yield {
        state: 'complete',
        query: '',
        results: [
          {
            title: 'Fetched competitor source',
            url,
            content: `Fetched evidence from ${url} includes pricing and reliability details.`
          }
        ],
        images: []
      }
    })
  }

  return {
    fetchTool,
    searchTool,
    createSearchTool: vi.fn(() => searchTool),
    contextToolFactory: vi.fn(() => ({ execute: vi.fn() }))
  }
})

vi.mock('@/lib/agents/chat/factory', () => ({
  createConfiguredChatAgent: vi.fn()
}))

vi.mock('@/lib/tools/search/server', () => ({
  createSearchTool: portabilityMocks.createSearchTool
}))

vi.mock('@/lib/tools/fetch/server', () => ({
  fetchTool: portabilityMocks.fetchTool
}))

vi.mock('@/lib/tools/create-canvas-artifact/server', () => ({
  serverTool: portabilityMocks.contextToolFactory
}))

vi.mock('@/lib/tools/generate-image/server', () => ({
  serverTool: portabilityMocks.contextToolFactory
}))

vi.mock('@/lib/tools/read-canvas-artifact/server', () => ({
  serverTool: portabilityMocks.contextToolFactory
}))

vi.mock('@/lib/tools/update-canvas-artifact/server', () => ({
  serverTool: portabilityMocks.contextToolFactory
}))

vi.mock('@/components/tool-ui/geo-map/geo-map', () => ({
  GeoMap: () => null
}))

import { createBuildAgentDefinition } from '@/lib/agents/chat/build'
import { resolveChatAgentId } from '@/lib/agents/chat/registry'
import { createResearchAgentDefinition } from '@/lib/agents/chat/research'
import { createSearchAgentDefinition } from '@/lib/agents/chat/search'
import {
  competitorResearchOutputSchema,
  competitorResearchToolName
} from '@/lib/agents/chat/specialists/competitor-research'
import { createChatAgentTools } from '@/lib/agents/chat/toolset'
import {
  mapDBPartToUIMessagePart,
  mapUIMessagePartsToDBParts
} from '@/lib/utils/message-mapping'

import { tryRenderToolUIByName } from '@/components/tool-ui/registry'

async function collectToolResult<T>(result: T | AsyncIterable<T>): Promise<T> {
  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    let finalChunk: T | undefined
    for await (const chunk of result as AsyncIterable<T>) {
      finalChunk = chunk
    }
    return finalChunk as T
  }

  return result as T
}

describe('community portability proof', () => {
  it('activates the ported specialist through the research agent only', () => {
    expect(
      resolveChatAgentId({
        userMode: 'research',
        searchMode: 'research'
      })
    ).toBe('research')

    const definition = createResearchAgentDefinition({ writer: {} as any })

    expect(definition.activeTools).toContain(competitorResearchToolName)
    expect(definition.activeTools).not.toContain('unknownCommunityGlue')
    expect(createSearchAgentDefinition().activeTools).not.toContain(
      competitorResearchToolName
    )
    expect(createBuildAgentDefinition().activeTools).not.toContain(
      competitorResearchToolName
    )
  })

  it('ports a structured tool through local toolset, Tool UI, and dynamic-part adapters', async () => {
    const input = {
      market: 'AI chat platforms',
      competitors: ['Alpha', 'Beta'],
      dimensions: ['UX', 'Reliability']
    }
    const tools = createChatAgentTools({
      model: 'gateway:google/gemini-3-flash',
      searchTool: portabilityMocks.searchTool as any
    } as any)

    const output = competitorResearchOutputSchema.parse(
      await collectToolResult(
        await tools.competitorResearch.execute?.(input, {} as never)
      )
    )

    expect(tools.search).toBe(portabilityMocks.searchTool)
    expect(portabilityMocks.searchTool.execute).toHaveBeenCalledTimes(2)
    expect(portabilityMocks.fetchTool.execute).toHaveBeenCalledTimes(2)
    expect(output.summary).toContain('using live search and fetch results')
    expect(output.matrix[0]?.UX).toContain('Fetched evidence')

    const rendered = tryRenderToolUIByName(
      competitorResearchToolName,
      output,
      'portable-competitor-research'
    )

    expect(isValidElement(rendered)).toBe(true)
    render(createElement(Fragment, null, rendered))
    expect(
      screen.getByRole('region', { name: 'Competitor research result' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Reliability' })
    ).toBeInTheDocument()

    const [dbPart] = mapUIMessagePartsToDBParts(
      [
        {
          type: 'tool-competitorResearch',
          toolCallId: 'call-portable-competitor-research',
          state: 'output-available',
          input,
          output,
          callProviderMetadata: {
            provider: {
              requestId: 'portable-proof'
            }
          }
        } as any
      ],
      'msg-portable'
    )

    expect(dbPart).toMatchObject({
      type: 'tool-dynamic',
      tool_toolCallId: 'call-portable-competitor-research',
      tool_state: 'output-available',
      tool_dynamic_name: competitorResearchToolName,
      tool_dynamic_type: 'dynamic',
      tool_dynamic_input: input,
      tool_dynamic_output: output,
      providerMetadata: {
        provider: {
          requestId: 'portable-proof'
        }
      }
    })

    expect(mapDBPartToUIMessagePart(dbPart as any)).toMatchObject({
      type: 'tool-competitorResearch',
      toolCallId: 'call-portable-competitor-research',
      state: 'output-available',
      input,
      output,
      callProviderMetadata: {
        provider: {
          requestId: 'portable-proof'
        }
      }
    })
  })
})
