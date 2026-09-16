import { stepCountIs, ToolLoopAgent } from 'ai'
import { describe, expect, it, vi } from 'vitest'

// Mock all tool imports
vi.mock('@/lib/tools/create-canvas-artifact', () => ({
  createCanvasArtifactTool: vi
    .fn()
    .mockReturnValue({ name: 'createCanvasArtifact' })
}))
vi.mock('@/lib/tools/create-canvas-artifact/server', () => ({
  serverTool: vi.fn().mockReturnValue({ name: 'createCanvasArtifact' })
}))
vi.mock('@/lib/tools/update-canvas-artifact', () => ({
  updateCanvasArtifactTool: vi
    .fn()
    .mockReturnValue({ name: 'updateCanvasArtifact' })
}))
vi.mock('@/lib/tools/update-canvas-artifact/server', () => ({
  serverTool: vi.fn().mockReturnValue({ name: 'updateCanvasArtifact' })
}))
vi.mock('@/lib/tools/read-canvas-artifact', () => ({
  readCanvasArtifactTool: vi
    .fn()
    .mockReturnValue({ name: 'readCanvasArtifact' })
}))
vi.mock('@/lib/tools/read-canvas-artifact/server', () => ({
  serverTool: vi.fn().mockReturnValue({ name: 'readCanvasArtifact' })
}))
vi.mock('@/lib/tools/display-callout', () => ({
  displayCalloutTool: { name: 'displayCallout' }
}))
vi.mock('@/lib/tools/display-chart', () => ({
  displayChartTool: { name: 'displayChart' }
}))
vi.mock('@/lib/tools/display-geo-map', () => ({
  displayGeoMapTool: { name: 'displayGeoMap' }
}))
vi.mock('@/lib/tools/display-citations', () => ({
  displayCitationsTool: { name: 'displayCitations' }
}))
vi.mock('@/lib/tools/display-citations/server', () => ({
  serverTool: { name: 'displayCitations' }
}))
vi.mock('@/lib/tools/display-link-preview', () => ({
  displayLinkPreviewTool: { name: 'displayLinkPreview' }
}))
vi.mock('@/lib/tools/display-link-preview/server', () => ({
  serverTool: { name: 'displayLinkPreview' }
}))
vi.mock('@/lib/tools/display-option-list', () => ({
  displayOptionListTool: { name: 'displayOptionList' }
}))
vi.mock('@/lib/tools/display-option-list/server', () => ({
  serverTool: { name: 'displayOptionList' }
}))
vi.mock('@/lib/tools/display-question-wizard/server', () => ({
  serverTool: { name: 'displayQuestionWizard' }
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
vi.mock('@/lib/tools/fetch/server', () => ({
  fetchTool: { name: 'fetch' }
}))
vi.mock('@/lib/tools/get-directions', () => ({
  getDirectionsTool: { name: 'getDirections' }
}))
vi.mock('@/lib/tools/geocode-address', () => ({
  geocodeAddressTool: { name: 'geocodeAddress' }
}))
vi.mock('@/lib/tools/get-isochrone', () => ({
  getIsochroneTool: { name: 'getIsochrone' }
}))
vi.mock('@/lib/tools/get-static-map-image', () => ({
  getStaticMapImageTool: { name: 'getStaticMapImage' }
}))
vi.mock('@/lib/tools/generate-image/server', () => ({
  serverTool: vi.fn().mockReturnValue({ name: 'generateImage' })
}))
vi.mock('@/lib/tools/search/server', () => ({
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
  getModel: vi.fn().mockReturnValue('mock-model'),
  isProviderEnabled: vi.fn().mockReturnValue(true)
}))
vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn().mockReturnValue(false),
  telemetryRecordingOptions: vi
    .fn()
    .mockReturnValue({ recordInputs: true, recordOutputs: true })
}))
vi.mock('@/lib/agents/prompts/search-mode-prompts', () => ({
  ARTIFACT_INTAKE_PROTOCOL: 'Artifact intake protocol',
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

import { createChatAgent } from '@/lib/agents/chat/registry'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'

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

describe('createChatAgent', () => {
  it('creates a researcher agent with default research mode', () => {
    const agent = createChatAgent({
      model: 'gateway:google/gemini-3-flash'
    })

    expect(agent).toBeDefined()
    expect(MockToolLoopAgent).toHaveBeenCalledTimes(1)

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.activeTools).toContain('search')
    expect(config.activeTools).toContain('fetch')
    expect(config.activeTools).toContain('displayTable')
    expect(config.activeTools).toContain('displayChart')
    expect(config.activeTools).toContain('displayGeoMap')
    expect(config.activeTools).toContain('getDirections')
    expect(config.activeTools).toContain('geocodeAddress')
    expect(config.activeTools).toContain('getIsochrone')
    expect(config.activeTools).toContain('getStaticMapImage')
    expect(config.activeTools).toContain('displayCitations')
    expect(config.activeTools).toContain('displayTimeline')
    expect(Object.keys(config.tools)).toContain('displayGeoMap')
    expect(Object.keys(config.tools)).toContain('getDirections')
    expect(Object.keys(config.tools)).toContain('geocodeAddress')
    expect(Object.keys(config.tools)).toContain('getIsochrone')
    expect(Object.keys(config.tools)).toContain('getStaticMapImage')
    // Research mode should NOT include displayPlan
    expect(config.activeTools).not.toContain('displayPlan')
    expect(vi.mocked(stepCountIs).mock.calls.at(-1)?.[0]).toBe(50)
  })

  it('configures chat mode with correct tools and step limit', () => {
    MockToolLoopAgent.mockClear()

    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'chat'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    // Chat mode should include displayPlan
    expect(config.activeTools).toContain('displayPlan')
    expect(config.activeTools).toContain('search')
    expect(config.activeTools).toContain('fetch')
    expect(config.activeTools).toContain('displayGeoMap')
    expect(config.activeTools).toContain('getDirections')
    expect(config.activeTools).toContain('geocodeAddress')
    expect(config.activeTools).toContain('getIsochrone')
    expect(config.activeTools).toContain('getStaticMapImage')
    expect(config.activeTools).toContain('displayTimeline')
    expect(Object.keys(config.tools)).toContain('displayGeoMap')
    // Chat mode should NOT include todoWrite
    expect(config.activeTools).not.toContain('todoWrite')
    expect(vi.mocked(stepCountIs).mock.calls.at(-1)?.[0]).toBe(20)
  })

  it('routes build intent through chat tools with the artifact intake prefix', () => {
    MockToolLoopAgent.mockClear()

    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'chat',
      intent: 'build'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.activeTools).toContain('displayPlan')
    expect(config.activeTools).not.toContain('todoWrite')
    expect(config.instructions).toContain('Artifact intake protocol')
    expect(
      config.instructions.indexOf('Artifact intake protocol')
    ).toBeLessThan(config.instructions.indexOf('Chat mode system prompt'))
    expect(vi.mocked(stepCountIs).mock.calls.at(-1)?.[0]).toBe(20)
  })

  it('includes todoWrite in research mode when writer is provided', () => {
    MockToolLoopAgent.mockClear()

    const mockWriter = {} as any
    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'research',
      writer: mockWriter
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.activeTools).toContain('todoWrite')
  })

  it('does not include todoWrite in research mode without writer', () => {
    MockToolLoopAgent.mockClear()

    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'research'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.activeTools).not.toContain('todoWrite')
  })

  it('passes provider options from model config', () => {
    MockToolLoopAgent.mockClear()

    const providerOptions = { temperature: 0.7 }
    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      modelConfig: { providerOptions } as any
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.providerOptions).toEqual(providerOptions)
  })

  it('includes telemetry configuration', () => {
    MockToolLoopAgent.mockClear()

    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      correlationId: 'trace-123',
      searchMode: 'research'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(config.experimental_telemetry).toBeDefined()
    expect(config.experimental_telemetry.functionId).toBe('research-agent')
    expect(config.experimental_telemetry.metadata.searchMode).toBe('research')
  })

  it('sets instructions with current date', () => {
    MockToolLoopAgent.mockClear()

    createChatAgent({
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

    createChatAgent({
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
    expect(config.instructions).toContain(
      'call readCanvasArtifact to fetch the latest source before updating'
    )
  })

  it('throws when model creation fails', async () => {
    const registry = await import('@/lib/utils/registry')
    vi.mocked(registry.getModel).mockImplementationOnce(() => {
      throw new Error('Invalid model')
    })

    expect(() => createChatAgent({ model: 'invalid-model' })).toThrow(
      'Invalid model'
    )
  })

  it('registers canvas tools when canvasToolContext is provided', () => {
    MockToolLoopAgent.mockClear()

    const agent = createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      canvasToolContext: mockCanvasToolContext
    })

    expect(agent).toBeDefined()
    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(Object.keys(config.tools)).toContain('createCanvasArtifact')
    expect(Object.keys(config.tools)).toContain('updateCanvasArtifact')
    expect(Object.keys(config.tools)).toContain('readCanvasArtifact')
    expect(config.activeTools).toContain('createCanvasArtifact')
    expect(config.activeTools).toContain('updateCanvasArtifact')
    expect(config.activeTools).toContain('readCanvasArtifact')
  })

  it('does not register canvas tools when canvasToolContext is absent', () => {
    MockToolLoopAgent.mockClear()

    const agent = createChatAgent({
      model: 'gateway:google/gemini-3-flash'
    })

    expect(agent).toBeDefined()
    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(Object.keys(config.tools)).not.toContain('createCanvasArtifact')
    expect(Object.keys(config.tools)).not.toContain('updateCanvasArtifact')
    expect(Object.keys(config.tools)).not.toContain('readCanvasArtifact')
    expect(config.activeTools).not.toContain('createCanvasArtifact')
    expect(config.activeTools).not.toContain('updateCanvasArtifact')
    expect(config.activeTools).not.toContain('readCanvasArtifact')
  })

  it('registers canvas tools in both chat and research modes', () => {
    for (const searchMode of ['chat', 'research'] as const) {
      MockToolLoopAgent.mockClear()

      createChatAgent({
        model: 'gateway:google/gemini-3-flash',
        searchMode,
        canvasToolContext: mockCanvasToolContext
      })

      const config = MockToolLoopAgent.mock.calls[0][0] as any
      expect(config.activeTools).toContain('createCanvasArtifact')
      expect(config.activeTools).toContain('updateCanvasArtifact')
      expect(config.activeTools).toContain('readCanvasArtifact')
    }
  })

  it('does not include old artifact tools', () => {
    MockToolLoopAgent.mockClear()

    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      canvasToolContext: mockCanvasToolContext
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    expect(Object.keys(config.tools)).not.toContain('createWebappArtifact')
    expect(Object.keys(config.tools)).not.toContain('updateWebappArtifact')
    expect(Object.keys(config.tools)).not.toContain('getArtifactStatus')
    expect(Object.keys(config.tools)).not.toContain('restartArtifactPreview')
  })

  it('applies pacing wrapper to search tool', () => {
    MockToolLoopAgent.mockClear()

    createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'research'
    })

    const config = MockToolLoopAgent.mock.calls[0][0] as any
    // The search tool should be wrapped via tool() (has _isTool marker from mock)
    expect(config.tools.search._isTool).toBe(true)
  })

  it('applies pacing wrapper in both chat and research modes', () => {
    for (const searchMode of ['chat', 'research'] as const) {
      MockToolLoopAgent.mockClear()

      createChatAgent({
        model: 'gateway:google/gemini-3-flash',
        searchMode
      })

      const config = MockToolLoopAgent.mock.calls[0][0] as any
      // Both modes should have the search tool wrapped via tool() calls
      expect(config.tools.search._isTool).toBe(true)
    }
  })

  it('creates request-local pacing per createResearcher call', () => {
    MockToolLoopAgent.mockClear()

    const agent1 = createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'research'
    })

    const agent2 = createChatAgent({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'research'
    })

    // Each call produces a separate agent with its own tools object
    expect(agent1).not.toBe(agent2)
    const config1 = MockToolLoopAgent.mock.calls[0][0] as any
    const config2 = MockToolLoopAgent.mock.calls[1][0] as any
    // Each agent got its own wrapped search tool (different object references)
    expect(config1.tools.search).not.toBe(config2.tools.search)
  })

  it('aborts cleanly during pacing cooldown', async () => {
    vi.useFakeTimers()
    MockToolLoopAgent.mockClear()

    try {
      const searchModule = await import('@/lib/tools/search/server')
      const mockedCreateSearchTool = vi.mocked(searchModule.createSearchTool)
      const underlyingExecute = vi.fn().mockResolvedValue({
        state: 'complete' as const,
        results: [],
        images: [],
        query: 'q',
        number_of_results: 0
      })
      mockedCreateSearchTool.mockReturnValueOnce({
        name: 'search',
        description: 'Search the web',
        inputSchema: {},
        execute: underlyingExecute
      } as any)

      createChatAgent({
        model: 'gateway:google/gemini-3-flash',
        searchMode: 'research'
      })

      const config = MockToolLoopAgent.mock.calls[0][0] as any
      const wrappedExecute = config.tools.search.execute

      // First call establishes lastCallTime via Date.now()
      // Use a non-zero baseline so the `lastCallTime > 0` guard triggers next time.
      vi.setSystemTime(new Date(1000))
      const firstController = new AbortController()
      const firstIter = wrappedExecute(
        { query: 'first' },
        { abortSignal: firstController.signal }
      )
      // Drain the first async generator to completion
      // (underlying returns a resolved object, wrapper yields it)
      while (true) {
        const step = await firstIter.next()
        if (step.done) break
      }

      expect(underlyingExecute).toHaveBeenCalledTimes(1)

      // Advance system time by only 50ms — within the 200ms pacing gap,
      // so the next call will enter the cooldown wait.
      vi.setSystemTime(new Date(1050))

      const controller = new AbortController()
      const secondIter = wrappedExecute(
        { query: 'second' },
        { abortSignal: controller.signal }
      )

      // Kick off the generator; it should enter the setTimeout wait
      const nextPromise = secondIter.next()

      // Abort during the cooldown; the abort listener resolves the wait,
      // and the post-wait guard in the search tool pacing wrapper bails before dispatch.
      controller.abort()

      const step = await nextPromise
      expect(step.done).toBe(true)

      // Underlying execute should not have been called a second time
      expect(underlyingExecute).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
