import { describe, expect, it, vi } from 'vitest'

import type { ChatSample } from './sampler'

function makeSample(overrides: Partial<ChatSample>): ChatSample {
  const userQuery = overrides.userQuery ?? 'test query'
  return {
    chatId: overrides.chatId ?? 'chat-wiring',
    createdAt: overrides.createdAt ?? new Date('2026-04-01T12:00:00Z'),
    targetUserMessageId: overrides.targetUserMessageId ?? 'user-1',
    targetAssistantMessageId:
      overrides.targetAssistantMessageId ?? 'assistant-1',
    userQuery,
    conversation: overrides.conversation ?? [
      {
        role: 'user',
        parts: [{ type: 'text', text: userQuery }]
      }
    ],
    searchMode: overrides.searchMode ?? 'chat',
    modelType: overrides.modelType ?? 'speed',
    metadataTags: overrides.metadataTags ?? ['mode_metadata_missing'],
    searchResults: overrides.searchResults ?? [],
    modelAnswer: overrides.modelAnswer ?? 'Test answer',
    citations: overrides.citations ?? [],
    toolNames: overrides.toolNames ?? []
  }
}

const mockCloseDb = vi.fn(async () => {})
const mockRunConfiguredModes = vi.fn(
  async () => [] as Array<import('./types').SuiteRunResult>
)

const fixtureSample = makeSample({
  chatId: 'chat-wiring',
  createdAt: new Date('2026-04-01T12:00:00Z'),
  userQuery: 'test query',
  searchResults: [
    {
      query: 'test',
      results: [
        { title: 'Result', url: 'https://example.com', snippet: 'A snippet' }
      ]
    }
  ],
  modelAnswer: 'Test answer',
  citations: [{ title: 'Source', url: 'https://source.com' }],
  toolNames: ['search']
})

vi.mock('./db', () => ({
  db: {},
  closeDb: mockCloseDb
}))

vi.mock('./config', () => ({
  config: {
    databaseUrl: 'postgresql://test',
    phoenixHost: 'http://localhost:6006',
    phoenixApiKey: 'test-key',
    judgeModel: 'gpt-4o-mini',
    sampleSize: 50,
    lookbackHours: 6,
    databaseSslDisabled: true,
    evalRunMode: 'traffic-monitor',
    evalRunnerUrl: 'https://example.com',
    evalRunnerSecret: 'secret',
    smokeEnabled: true,
    smokeCaseCount: 1
  }
}))

vi.mock('./judge-config', () => ({
  validateJudgeCredentials: vi.fn(),
  createJudgeConfig: vi.fn(() => ({
    judgeModel: 'gpt-4o-mini',
    judgeBaseUrl: 'https://openrouter.ai/api/v1',
    judgeApiKey: 'test-key',
    judgeReasoningEnabled: true,
    judgeReasoningMaxTokens: 1024
  })),
  validInt: vi.fn((raw: string | undefined, fallback: number) =>
    raw ? parseInt(raw, 10) || fallback : fallback
  ),
  validBool: vi.fn((raw: string | undefined, fallback: boolean) =>
    raw != null ? raw === 'true' : fallback
  )
}))

vi.mock('./orchestrator', () => ({
  runConfiguredModes: mockRunConfiguredModes
}))

describe('formatContext', () => {
  it('formats search results with query headers', async () => {
    const { formatContext } = await import('./runners/traffic-monitor')

    const sample = makeSample({
      chatId: 'chat-1',
      createdAt: new Date('2026-04-01'),
      userQuery: 'what is AI?',
      searchResults: [
        {
          query: 'artificial intelligence',
          results: [
            {
              title: 'AI Wikipedia',
              url: 'https://en.wikipedia.org/wiki/AI',
              snippet: 'AI is the simulation of human intelligence'
            }
          ]
        }
      ],
      modelAnswer: 'AI stands for artificial intelligence.',
      citations: [],
      toolNames: ['search']
    })

    const result = formatContext(sample)
    expect(result).toContain('[Search: "artificial intelligence"]')
    expect(result).toContain(
      '- [AI Wikipedia](https://en.wikipedia.org/wiki/AI): AI is the simulation of human intelligence'
    )
    expect(result).not.toContain('[Citations]')
  })

  it('formats citations when present', async () => {
    const { formatContext } = await import('./runners/traffic-monitor')

    const sample = makeSample({
      chatId: 'chat-2',
      createdAt: new Date('2026-04-01'),
      userQuery: 'what is quantum computing?',
      searchResults: [],
      modelAnswer: 'Quantum computing uses qubits.',
      citations: [
        { title: 'Quantum Wiki', url: 'https://example.com/quantum' }
      ],
      toolNames: []
    })

    const result = formatContext(sample)
    expect(result).toContain('[Citations]')
    expect(result).toContain('- [Quantum Wiki](https://example.com/quantum)')
  })

  it('returns empty string when no search results or citations', async () => {
    const { formatContext } = await import('./runners/traffic-monitor')

    const sample = makeSample({
      chatId: 'chat-3',
      createdAt: new Date('2026-04-01'),
      userQuery: 'hello',
      searchResults: [],
      modelAnswer: 'Hi!',
      citations: [],
      toolNames: []
    })

    const result = formatContext(sample)
    expect(result).toBe('')
  })

  it('formats multiple search results and citations together', async () => {
    const { formatContext } = await import('./runners/traffic-monitor')

    const sample = makeSample({
      chatId: 'chat-4',
      createdAt: new Date('2026-04-01'),
      userQuery: 'climate change',
      searchResults: [
        {
          query: 'climate change effects',
          results: [
            {
              title: 'NASA Climate',
              url: 'https://nasa.gov/climate',
              snippet: 'Rising temperatures worldwide'
            },
            {
              title: 'IPCC Report',
              url: 'https://ipcc.ch',
              snippet: 'Human activities are the main cause'
            }
          ]
        },
        {
          query: 'climate solutions',
          results: [
            {
              title: 'Renewable Energy',
              url: 'https://energy.gov',
              snippet: 'Solar and wind power'
            }
          ]
        }
      ],
      modelAnswer: 'Climate change is a global challenge.',
      citations: [
        { title: 'NASA', url: 'https://nasa.gov/climate' },
        { title: 'IPCC', url: 'https://ipcc.ch' }
      ],
      toolNames: ['search']
    })

    const result = formatContext(sample)
    expect(result).toContain('[Search: "climate change effects"]')
    expect(result).toContain('[Search: "climate solutions"]')
    expect(result).toContain(
      '- [NASA Climate](https://nasa.gov/climate): Rising temperatures worldwide'
    )
    expect(result).toContain(
      '- [IPCC Report](https://ipcc.ch): Human activities are the main cause'
    )
    expect(result).toContain(
      '- [Renewable Energy](https://energy.gov): Solar and wind power'
    )
    expect(result).toContain('[Citations]')
    expect(result).toContain('- [NASA](https://nasa.gov/climate)')
    expect(result).toContain('- [IPCC](https://ipcc.ch)')
  })
})

describe('main lifecycle', () => {
  it('runs configured modes and closes the db afterward', async () => {
    const { main } = await import('./index')

    const result = await main()

    expect(mockRunConfiguredModes).toHaveBeenCalledTimes(1)
    expect(mockCloseDb).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('logs when a run completes with threshold breach alerts', async () => {
    mockRunConfiguredModes.mockResolvedValueOnce([
      {
        suite: 'capability',
        status: 'threshold_breached',
        passRate: 0.72,
        threshold: 0.8,
        failedEvaluators: ['faithfulness'],
        experimentName: 'exp-1',
        datasetName: 'ds-1',
        phoenixUrl: null,
        totalCases: 12,
        attemptedCases: 12,
        failedCases: 0
      }
    ] satisfies Array<import('./types').SuiteRunResult>)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { main } = await import('./index')
    await main()

    expect(warnSpy).toHaveBeenCalledWith(
      '[evals] Completed with 1 threshold breach alert(s)'
    )
    warnSpy.mockRestore()
  })

  it('formatContext is importable from the source module', async () => {
    const { formatContext } = await import('./runners/traffic-monitor')

    expect(formatContext(fixtureSample)).toContain('[Search: "test"]')
  })
})
