import { beforeEach, describe, expect, it, vi } from 'vitest'

const agentMocks = vi.hoisted(() => ({
  createSearchAgent: vi.fn(() => ({ agentId: 'search-agent' })),
  createResearchAgent: vi.fn(() => ({ agentId: 'research-agent' })),
  createBuildAgent: vi.fn(() => ({ agentId: 'build-agent' }))
}))

const toolWiringMocks = vi.hoisted(() => {
  const rawSearchTool = {
    description: 'raw search',
    inputSchema: {},
    execute: vi.fn(async function* () {
      yield {
        state: 'complete',
        results: [],
        images: []
      }
    })
  }
  const configuredSearchTool = {
    description: 'configured search',
    inputSchema: {},
    execute: vi.fn(async function* () {
      yield {
        state: 'complete',
        results: [],
        images: []
      }
    })
  }

  return {
    rawSearchTool,
    configuredSearchTool,
    staticTool: { execute: vi.fn() },
    createSearchTool: vi.fn(() => rawSearchTool),
    createServerTool: vi.fn(() => ({ execute: vi.fn() })),
    createTodoTools: vi.fn(() => ({ todoWrite: { execute: vi.fn() } })),
    ToolLoopAgent: vi.fn(config => ({ config })),
    stepCountIs: vi.fn(maxSteps => ({ maxSteps })),
    tool: vi.fn(config => config),
    getModel: vi.fn(model => ({ model })),
    isTracingEnabled: vi.fn(() => false)
  }
})

vi.mock('@/lib/agents/chat/search', () => ({
  createSearchAgent: agentMocks.createSearchAgent
}))

vi.mock('@/lib/agents/chat/research', () => ({
  createResearchAgent: agentMocks.createResearchAgent
}))

vi.mock('@/lib/agents/chat/build', () => ({
  createBuildAgent: agentMocks.createBuildAgent
}))

vi.mock('ai', () => ({
  ToolLoopAgent: toolWiringMocks.ToolLoopAgent,
  stepCountIs: toolWiringMocks.stepCountIs,
  tool: toolWiringMocks.tool
}))

vi.mock('@/lib/tools/search/server', () => ({
  createSearchTool: toolWiringMocks.createSearchTool
}))

vi.mock('@/lib/utils/registry', () => ({
  getModel: toolWiringMocks.getModel
}))

vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: toolWiringMocks.isTracingEnabled
}))

vi.mock('@/lib/tools/create-canvas-artifact/server', () => ({
  serverTool: toolWiringMocks.createServerTool
}))

vi.mock('@/lib/tools/display-callout/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-chart/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-citations/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-geo-map', () => ({
  displayGeoMapTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-link-preview/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-option-list/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-plan/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-question-wizard/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-table/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/display-timeline/server', () => ({
  serverTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/fetch/server', () => ({
  fetchTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/generate-image/server', () => ({
  serverTool: toolWiringMocks.createServerTool
}))

vi.mock('@/lib/tools/geocode-address', () => ({
  geocodeAddressTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/get-directions', () => ({
  getDirectionsTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/get-isochrone', () => ({
  getIsochroneTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/get-static-map-image', () => ({
  getStaticMapImageTool: toolWiringMocks.staticTool
}))

vi.mock('@/lib/tools/read-canvas-artifact/server', () => ({
  serverTool: toolWiringMocks.createServerTool
}))

vi.mock('@/lib/tools/todo', () => ({
  createTodoTools: toolWiringMocks.createTodoTools
}))

vi.mock('@/lib/tools/update-canvas-artifact/server', () => ({
  serverTool: toolWiringMocks.createServerTool
}))

import {
  type ChatAgentDefinition,
  createConfiguredChatAgent
} from '@/lib/agents/chat/factory'
import { createChatAgent, resolveChatAgentId } from '@/lib/agents/chat/registry'
import { createChatAgentTools } from '@/lib/agents/chat/toolset'

function makeArgs(overrides: Record<string, unknown> = {}) {
  return {
    model: 'gateway:google/gemini-3-flash',
    ...overrides
  } as any
}

const competitorResearchInput = {
  market: 'AI chat platforms',
  competitors: ['Alpha', 'Beta'],
  dimensions: ['Pricing']
}

describe('chat agent registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves stable agent ids from user mode, search mode, and intent', () => {
    expect(
      resolveChatAgentId({
        userMode: 'search',
        searchMode: 'chat'
      })
    ).toBe('search')
    expect(
      resolveChatAgentId({
        userMode: 'research',
        searchMode: 'research'
      })
    ).toBe('research')
    expect(
      resolveChatAgentId({
        userMode: 'build',
        searchMode: 'chat',
        intent: 'build'
      })
    ).toBe('build')
    expect(
      resolveChatAgentId({
        searchMode: 'chat',
        intent: 'build'
      })
    ).toBe('build')
  })

  it('delegates chat agent construction to the selected agent module', () => {
    expect(createChatAgent(makeArgs({ userMode: 'search' }))).toEqual({
      agentId: 'search-agent'
    })
    expect(createChatAgent(makeArgs({ searchMode: 'research' }))).toEqual({
      agentId: 'research-agent'
    })
    expect(createChatAgent(makeArgs({ intent: 'build' }))).toEqual({
      agentId: 'build-agent'
    })

    expect(agentMocks.createSearchAgent).toHaveBeenCalledWith(
      expect.objectContaining({ userMode: 'search' })
    )
    expect(agentMocks.createResearchAgent).toHaveBeenCalledWith(
      expect.objectContaining({ searchMode: 'research' })
    )
    expect(agentMocks.createBuildAgent).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'build' })
    )
  })

  it('wires competitor research to the search tool provided to the toolset', async () => {
    const tools = createChatAgentTools({
      model: 'gateway:google/gemini-3-flash',
      searchTool: toolWiringMocks.configuredSearchTool
    } as any)

    await tools.competitorResearch.execute?.(competitorResearchInput, {} as any)

    expect(tools.search).toBe(toolWiringMocks.configuredSearchTool)
    expect(toolWiringMocks.configuredSearchTool.execute).toHaveBeenCalledTimes(
      2
    )
    expect(toolWiringMocks.rawSearchTool.execute).not.toHaveBeenCalled()
  })

  it('passes the configured search instance through factory-built tools', async () => {
    const definition: ChatAgentDefinition = {
      agentId: 'research',
      systemPrompt: 'Research agent',
      activeTools: ['search', 'competitorResearch', 'fetch'],
      maxSteps: 50,
      configureSearchTool: vi.fn(
        () => toolWiringMocks.configuredSearchTool as any
      )
    }

    createConfiguredChatAgent(
      { model: 'gateway:google/gemini-3-flash' },
      definition
    )

    const agentConfig = toolWiringMocks.ToolLoopAgent.mock.calls[0]?.[0] as any
    await agentConfig.tools.competitorResearch.execute?.(
      competitorResearchInput,
      {} as any
    )

    expect(definition.configureSearchTool).toHaveBeenCalledWith(
      toolWiringMocks.rawSearchTool
    )
    expect(toolWiringMocks.createSearchTool).toHaveBeenCalledTimes(1)
    expect(agentConfig.tools.search).toBe(toolWiringMocks.configuredSearchTool)
    expect(toolWiringMocks.configuredSearchTool.execute).toHaveBeenCalledTimes(
      2
    )
    expect(toolWiringMocks.rawSearchTool.execute).not.toHaveBeenCalled()
  })
})
