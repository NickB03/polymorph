import { describe, expect, it, vi } from 'vitest'

import type { ChatSample } from './sampler'

const mockCloseDb = vi.fn(async () => {})
const mockRunConfiguredModes = vi.fn(async () => {})

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

vi.mock('./orchestrator', () => ({
  runConfiguredModes: mockRunConfiguredModes
}))

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

describe('main lifecycle', () => {
  it('runs configured modes and closes the db afterward', async () => {
    const { main } = await import('./index')

    await main()

    expect(mockRunConfiguredModes).toHaveBeenCalledTimes(1)
    expect(mockCloseDb).toHaveBeenCalledTimes(1)
  })

  it('keeps the traffic-monitor formatter exported from index', async () => {
    const { formatContext } = await import('./index')

    expect(formatContext(fixtureSample)).toContain('[Search: "test"]')
  })
})
