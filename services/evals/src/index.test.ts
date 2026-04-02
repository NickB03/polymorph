import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { ChatSample } from './sampler'

// --- Top-level mocks (vi.mock is hoisted, so variable refs must be at module scope) ---

const mockCreateClient = vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() }))
const mockCreateOrGetDataset = vi.fn(async () => ({ datasetId: 'ds-test' }))
const mockRunExperiment = vi.fn(async () => ({ id: 'exp-test' }))
const mockCloseDb = vi.fn(async () => {})

const fixtureSample: ChatSample = {
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
  citations: [{ title: 'Source', url: 'https://source.com' }]
}

const mockSampleRecentChats = vi.fn(async () => [fixtureSample])

vi.mock('./config', () => ({
  config: {
    databaseUrl: 'postgresql://test',
    phoenixHost: 'http://localhost:6006',
    phoenixApiKey: 'test-key',
    judgeModel: 'gpt-4o-mini',
    sampleSize: 50,
    lookbackHours: 6,
    databaseSslDisabled: true
  }
}))

vi.mock('./db', () => ({
  db: {},
  closeDb: mockCloseDb
}))

vi.mock('./sampler', () => ({
  sampleRecentChats: mockSampleRecentChats
}))

vi.mock('@arizeai/phoenix-client', () => ({
  createClient: mockCreateClient
}))

vi.mock('@arizeai/phoenix-client/datasets', () => ({
  createOrGetDataset: mockCreateOrGetDataset
}))

vi.mock('@arizeai/phoenix-client/experiments', () => ({
  runExperiment: mockRunExperiment,
  asExperimentEvaluator: vi.fn(e => e)
}))

vi.mock('@arizeai/phoenix-evals', () => ({
  createFaithfulnessEvaluator: () => ({ evaluate: vi.fn() }),
  createDocumentRelevanceEvaluator: () => ({ evaluate: vi.fn() }),
  createClassificationEvaluator: () => ({ evaluate: vi.fn() })
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => ({}))
}))

// --- Tests ---

describe('formatContext', () => {
  it('formats search results with query headers', async () => {
    const { formatContext } = await import('./index')

    const sample: ChatSample = {
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
      citations: []
    }

    const result = formatContext(sample)
    expect(result).toContain('[Search: "artificial intelligence"]')
    expect(result).toContain(
      '- AI Wikipedia: AI is the simulation of human intelligence'
    )
    expect(result).not.toContain('[Citations]')
  })

  it('formats citations when present', async () => {
    const { formatContext } = await import('./index')

    const sample: ChatSample = {
      chatId: 'chat-2',
      createdAt: new Date('2026-04-01'),
      userQuery: 'what is quantum computing?',
      searchResults: [],
      modelAnswer: 'Quantum computing uses qubits.',
      citations: [{ title: 'Quantum Wiki', url: 'https://example.com/quantum' }]
    }

    const result = formatContext(sample)
    expect(result).toContain('[Citations]')
    expect(result).toContain('- Quantum Wiki (https://example.com/quantum)')
  })

  it('returns empty string when no search results or citations', async () => {
    const { formatContext } = await import('./index')

    const sample: ChatSample = {
      chatId: 'chat-3',
      createdAt: new Date('2026-04-01'),
      userQuery: 'hello',
      searchResults: [],
      modelAnswer: 'Hi!',
      citations: []
    }

    const result = formatContext(sample)
    expect(result).toBe('')
  })

  it('formats multiple search results and citations together', async () => {
    const { formatContext } = await import('./index')

    const sample: ChatSample = {
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
      ]
    }

    const result = formatContext(sample)
    expect(result).toContain('[Search: "climate change effects"]')
    expect(result).toContain('[Search: "climate solutions"]')
    expect(result).toContain('- NASA Climate: Rising temperatures worldwide')
    expect(result).toContain(
      '- IPCC Report: Human activities are the main cause'
    )
    expect(result).toContain('- Renewable Energy: Solar and wind power')
    expect(result).toContain('[Citations]')
    expect(result).toContain('- NASA (https://nasa.gov/climate)')
    expect(result).toContain('- IPCC (https://ipcc.ch)')
  })
})

describe('experiment runner wiring', () => {
  beforeAll(async () => {
    // Import triggers main() which runs asynchronously
    await import('./index')
    // Give main() time to complete all async operations
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('calls createClient with explicit baseUrl', () => {
    expect(mockCreateClient).toHaveBeenCalledWith({
      options: { baseUrl: 'http://localhost:6006' }
    })
  })

  it('calls createOrGetDataset with expected shape', () => {
    expect(mockCreateOrGetDataset).toHaveBeenCalledTimes(1)
    const calls = mockCreateOrGetDataset.mock.calls as unknown as Record<
      string,
      unknown
    >[][]
    const call = calls[0]![0]!
    expect(call).toHaveProperty('client')
    expect(call).toHaveProperty('name')
    expect(call.name).toMatch(/^polymorph-eval-/)
    expect(call).toHaveProperty('examples')
    const examples = call.examples as Record<string, unknown>[]
    expect(examples).toHaveLength(1)
    expect(examples[0]!.input).toHaveProperty('query', 'test query')
    expect(examples[0]!.output).toHaveProperty('answer', 'Test answer')
  })

  it('calls runExperiment with 3 evaluators and concurrency 3', () => {
    expect(mockRunExperiment).toHaveBeenCalledTimes(1)
    const calls = mockRunExperiment.mock.calls as unknown as Record<
      string,
      unknown
    >[][]
    const call = calls[0]![0]!
    expect(call).toHaveProperty('evaluators')
    expect(call.evaluators).toHaveLength(3)
    expect(call.concurrency).toBe(3)
    expect(call.dataset).toEqual({ datasetId: 'ds-test' })
  })

  it('calls closeDb on completion', () => {
    expect(mockCloseDb).toHaveBeenCalled()
  })
})
