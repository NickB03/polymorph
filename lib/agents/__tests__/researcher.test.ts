import { ToolLoopAgent } from 'ai'
import { describe, expect, it, vi } from 'vitest'

// Mock all tool imports
vi.mock('@/lib/tools/create-canvas-artifact', () => ({
  createCanvasArtifactTool: vi
    .fn()
    .mockReturnValue({ name: 'createCanvasArtifact' })
}))
vi.mock('@/lib/tools/update-canvas-artifact', () => ({
  updateCanvasArtifactTool: vi
    .fn()
    .mockReturnValue({ name: 'updateCanvasArtifact' })
}))
vi.mock('@/lib/tools/display-callout', () => ({
  displayCalloutTool: { name: 'displayCallout' }
}))
vi.mock('@/lib/tools/display-chart', () => ({
  displayChartTool: { name: 'displayChart' }
}))
vi.mock('@/lib/tools/display-citations', () => ({
  displayCitationsTool: { name: 'displayCitations' }
}))
vi.mock('@/lib/tools/display-link-preview', () => ({
  displayLinkPreviewTool: { name: 'displayLinkPreview' }
}))
vi.mock('@/lib/tools/display-option-list', () => ({
  displayOptionListTool: { name: 'displayOptionList' }
}))
vi.mock('@/lib/tools/display-plan', () => ({
  displayPlanTool: { name: 'displayPlan' }
}))
vi.mock('@/lib/tools/display-table', () => ({
  displayTableTool: { name: 'displayTable' }
}))
vi.mock('@/lib/tools/display-timeline', () => ({
  displayTimelineTool: { name: 'displayTimeline' }
}))
vi.mock('@/lib/tools/fetch', () => ({
  fetchTool: { name: 'fetch' }
}))
vi.mock('@/lib/tools/search', () => ({
  createSearchTool: vi.fn().mockReturnValue({
    name: 'search',
    description: 'Search the web',
    inputSchema: {},
    execute: vi.fn()
  })
}))
vi.mock('@/lib/tools/todo', () => ({
  createTodoTools: vi.fn().mockReturnValue({
    todoWrite: { name: 'todoWrite' }
  })
}))
vi.mock('@/lib/utils/registry', () => ({
  getModel: vi.fn().mockReturnValue('mock-model')
}))
vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn().mockReturnValue(false)
}))
vi.mock('@/lib/agents/prompts/search-mode-prompts', () => ({
  CHAT_MODE_PROMPT: 'Chat mode system prompt',
  RESEARCH_MODE_PROMPT: 'Research mode system prompt'
}))

// Mock ToolLoopAgent constructor
vi.mock('ai', async importOriginal => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    ToolLoopAgent: vi.fn().mockImplementation(config => ({
      ...config,
      _isAgent: true,
      tools: config.tools
    })),
    stepCountIs: vi.fn().mockReturnValue('stepCountPredicate'),
    tool: vi.fn().mockImplementation(config => ({
      ...config,
      _isTool: true
    }))
  }
})

import type { CanvasToolContext } from '@/lib/canvas/tool-context'

import { createResearcher } from '../researcher'

const MockToolLoopAgent = vi.mocked(ToolLoopAgent)

const mockCanvasToolContext: CanvasToolContext = {
  chatId: 'chat-1',
  userId: 'user-1',
  isGuest: false,
  emitter: {
    emitCanvasArtifact: vi.fn(),
    emitCanvasArtifactStatus: vi.fn(),
    emitCanvasArtifactEvent: vi.fn(),
    emitCanvasDiagnostics: vi.fn()
  }
}

describe('createResearcher', () => {
  it('creates a researcher agent with default research mode', () => {
    const agent = createResearcher({
      model: 'gateway:google/gemini-3-flash'
    })

    expect(agent).toBeDefined()
    expect(MockToolLoopAgent).toHaveBeenCalledTimes(1)

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.activeTools).toContain('search')
    expect(config.activeTools).toContain('fetch')
    expect(config.activeTools).toContain('displayTable')
    expect(config.activeTools).toContain('displayChart')
    expect(config.activeTools).toContain('displayCitations')
    // Research mode should NOT include displayPlan
    expect(config.activeTools).not.toContain('displayPlan')
  })

  it('configures chat mode with correct tools and step limit', () => {
    MockToolLoopAgent.mockClear()

    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'chat'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    // Chat mode should include displayPlan
    expect(config.activeTools).toContain('displayPlan')
    expect(config.activeTools).toContain('search')
    expect(config.activeTools).toContain('fetch')
    // Chat mode should NOT include todoWrite
    expect(config.activeTools).not.toContain('todoWrite')
  })

  it('includes todoWrite in research mode when writer is provided', () => {
    MockToolLoopAgent.mockClear()

    const mockWriter = {} as any
    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'research',
      writer: mockWriter
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.activeTools).toContain('todoWrite')
  })

  it('does not include todoWrite in research mode without writer', () => {
    MockToolLoopAgent.mockClear()

    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'research'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.activeTools).not.toContain('todoWrite')
  })

  it('passes provider options from model config', () => {
    MockToolLoopAgent.mockClear()

    const providerOptions = { temperature: 0.7 }
    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      modelConfig: { providerOptions } as any
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.providerOptions).toEqual(providerOptions)
  })

  it('includes telemetry configuration', () => {
    MockToolLoopAgent.mockClear()

    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      parentTraceId: 'trace-123',
      searchMode: 'research'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.experimental_telemetry).toBeDefined()
    expect(config.experimental_telemetry.functionId).toBe('research-agent')
    expect(config.experimental_telemetry.metadata.searchMode).toBe('research')
    expect(config.experimental_telemetry.metadata.langfuseTraceId).toBe(
      'trace-123'
    )
  })

  it('sets instructions with current date', () => {
    MockToolLoopAgent.mockClear()

    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'chat'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.instructions).toContain('Chat mode system prompt')
    expect(config.instructions).toContain('Current date and time:')
    expect(config.instructions).not.toContain('Current canvas artifact state:')
  })

  it('includes current canvas artifact state in instructions when available', () => {
    MockToolLoopAgent.mockClear()

    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      canvasToolContext: {
        ...mockCanvasToolContext,
        currentArtifact: {
          artifactId: 'art-123',
          draftRevision: 7
        }
      }
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.instructions).toContain('Current canvas artifact state:')
    expect(config.instructions).toContain('- artifactId: art-123')
    expect(config.instructions).toContain('- baseRevision: 7')
  })

  it('throws when model creation fails', async () => {
    const registry = await import('@/lib/utils/registry')
    vi.mocked(registry.getModel).mockImplementationOnce(() => {
      throw new Error('Invalid model')
    })

    expect(() => createResearcher({ model: 'invalid-model' })).toThrow(
      'Invalid model'
    )
  })

  it('registers canvas tools when canvasToolContext is provided', () => {
    MockToolLoopAgent.mockClear()

    const agent = createResearcher({
      model: 'gateway:google/gemini-3-flash',
      canvasToolContext: mockCanvasToolContext
    })

    expect(agent).toBeDefined()
    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(Object.keys(config.tools)).toContain('createCanvasArtifact')
    expect(Object.keys(config.tools)).toContain('updateCanvasArtifact')
    expect(config.activeTools).toContain('createCanvasArtifact')
    expect(config.activeTools).toContain('updateCanvasArtifact')
  })

  it('does not register canvas tools when canvasToolContext is absent', () => {
    MockToolLoopAgent.mockClear()

    const agent = createResearcher({
      model: 'gateway:google/gemini-3-flash'
    })

    expect(agent).toBeDefined()
    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(Object.keys(config.tools)).not.toContain('createCanvasArtifact')
    expect(Object.keys(config.tools)).not.toContain('updateCanvasArtifact')
    expect(config.activeTools).not.toContain('createCanvasArtifact')
    expect(config.activeTools).not.toContain('updateCanvasArtifact')
  })

  it('registers canvas tools in both chat and research modes', () => {
    for (const searchMode of ['chat', 'research'] as const) {
      MockToolLoopAgent.mockClear()

      createResearcher({
        model: 'gateway:google/gemini-3-flash',
        searchMode,
        canvasToolContext: mockCanvasToolContext
      })

      const config = MockToolLoopAgent.mock.calls[0][0] as any
      expect(config.activeTools).toContain('createCanvasArtifact')
      expect(config.activeTools).toContain('updateCanvasArtifact')
    }
  })

  it('does not include old artifact tools', () => {
    MockToolLoopAgent.mockClear()

    createResearcher({
      model: 'gateway:google/gemini-3-flash',
      canvasToolContext: mockCanvasToolContext
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(Object.keys(config.tools)).not.toContain('createWebappArtifact')
    expect(Object.keys(config.tools)).not.toContain('updateWebappArtifact')
    expect(Object.keys(config.tools)).not.toContain('getArtifactStatus')
    expect(Object.keys(config.tools)).not.toContain('restartArtifactPreview')
  })
})
