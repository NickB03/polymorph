import { context, trace, type Tracer } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { SearchResults } from '@/lib/types'

// Mock `exa-js` at module-load time so the second test exercises an
// end-to-end multi-provider fallback without depending on the Exa SDK's
// transport. Per-test behavior is configured via
// `mockExaSearchAndContents` below.
const mockExaSearchAndContents = vi.fn()
vi.mock('exa-js', () => ({
  default: class MockExa {
    constructor() {}
    searchAndContents = (...args: unknown[]) =>
      mockExaSearchAndContents(...args)
  }
}))

// Telemetry must be wired via `trace.getActiveSpan()`, so we register a
// real OTel TracerProvider with an in-memory exporter and wrap the search
// tool execution inside an active span. The assertions then read the
// recorded span events/attributes from the exporter. Setup is scoped to
// this file's lifecycle so it doesn't leak global OTel state into
// sibling test files.
let exporter: InMemorySpanExporter
let provider: BasicTracerProvider
let contextManager: AsyncLocalStorageContextManager
let tracer: Tracer

async function collectCompleteResult(
  iterable: AsyncIterable<unknown>
): Promise<SearchResults | null> {
  let finalResult: SearchResults | null = null
  for await (const chunk of iterable) {
    if (
      chunk &&
      typeof chunk === 'object' &&
      'state' in chunk &&
      (chunk as { state: string }).state === 'complete'
    ) {
      const { state: _state, ...rest } = chunk as { state: string } & Record<
        string,
        unknown
      >
      finalResult = rest as unknown as SearchResults
    }
  }
  return finalResult
}

async function runInSpan<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; span: ReadableSpan }> {
  return await tracer.startActiveSpan(name, async span => {
    try {
      const result = await fn()
      return { result, span: span as unknown as ReadableSpan }
    } finally {
      span.end()
    }
  })
}

function findExportedSpan(name: string): ReadableSpan | undefined {
  return exporter.getFinishedSpans().find(s => s.name === name)
}

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('search telemetry (retry + fallback + aggregate)', () => {
  let savedTavilyKey: string | undefined
  let savedBraveKey: string | undefined
  let savedExaKey: string | undefined
  let savedFirecrawlKey: string | undefined
  let savedSearchApi: string | undefined

  beforeAll(() => {
    exporter = new InMemorySpanExporter()
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)]
    })
    contextManager = new AsyncLocalStorageContextManager()
    contextManager.enable()
    context.setGlobalContextManager(contextManager)
    trace.setGlobalTracerProvider(provider)
    tracer = provider.getTracer('test')
  })

  afterAll(() => {
    trace.disable()
    context.disable()
  })

  beforeEach(() => {
    savedTavilyKey = process.env.TAVILY_API_KEY
    savedBraveKey = process.env.BRAVE_SEARCH_API_KEY
    savedExaKey = process.env.EXA_API_KEY
    savedFirecrawlKey = process.env.FIRECRAWL_API_KEY
    savedSearchApi = process.env.SEARCH_API
    mockFetch.mockReset()
    mockExaSearchAndContents.mockReset()
    exporter.reset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    // Ensure we run through the real provider sequence without being
    // derailed by globally-configured keys/API.
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    delete process.env.BRAVE_SEARCH_API_KEY
    delete process.env.EXA_API_KEY
    delete process.env.FIRECRAWL_API_KEY
    process.env.SEARCH_API = 'tavily'
  })

  afterEach(() => {
    process.env.TAVILY_API_KEY = savedTavilyKey
    process.env.BRAVE_SEARCH_API_KEY = savedBraveKey
    process.env.EXA_API_KEY = savedExaKey
    process.env.FIRECRAWL_API_KEY = savedFirecrawlKey
    process.env.SEARCH_API = savedSearchApi
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('records a search.retry event and a success aggregate attribute', async () => {
    // First call returns a retryable 429; second returns success.
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('Rate limited'),
        headers: new Headers()
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { title: 'OK', content: 'content', url: 'https://ok.com' }
            ],
            images: [],
            query: 'telemetry test',
            number_of_results: 1
          })
      })

    const { createSearchTool } = await import('@/lib/tools/search')
    const searchTool = createSearchTool('gateway:google/gemini-3-flash')

    const { result } = await runInSpan('test-search', async () => {
      const iterable = searchTool.execute?.(
        {
          query: 'telemetry test',
          type: 'optimized',
          content_types: ['web'],
          max_results: 10,
          search_depth: 'basic',
          include_domains: [],
          exclude_domains: []
        },
        { toolCallId: 'tc-1', messages: [] } as any
      )

      if (!iterable || !(Symbol.asyncIterator in iterable)) {
        throw new Error('expected async iterable')
      }
      return await collectCompleteResult(iterable as AsyncIterable<unknown>)
    })

    expect(result).not.toBeNull()
    expect(result!.results[0]?.title).toBe('OK')

    const exported = findExportedSpan('test-search')
    expect(exported).toBeDefined()

    // Retry event with correct attributes
    const retryEvents = exported!.events.filter(e => e.name === 'search.retry')
    expect(retryEvents.length).toBe(1)
    const retryAttrs = retryEvents[0].attributes ?? {}
    expect(retryAttrs['search.retry.provider']).toBe('tavily')
    expect(retryAttrs['search.retry.attempt']).toBe(1)
    expect(retryAttrs['search.retry.max_attempts']).toBe(3)
    expect(retryAttrs['search.retry.status_code']).toBe(429)
    expect(
      typeof retryAttrs['search.retry.delay_ms'] === 'number' &&
        (retryAttrs['search.retry.delay_ms'] as number) > 0
    ).toBe(true)
    expect(typeof retryAttrs['search.retry.error_message']).toBe('string')

    // Aggregate turn attributes
    const attrs = exported!.attributes
    expect(attrs['search.turn.outcome']).toBe('success')
    expect(attrs['search.turn.total_retries']).toBe(1)
    expect(attrs['search.turn.total_fallbacks']).toBe(0)
    expect(attrs['search.turn.final_provider']).toBe('tavily')
    const providersAttempted = attrs[
      'search.turn.providers_attempted'
    ] as unknown as string[]
    expect(Array.isArray(providersAttempted)).toBe(true)
    expect(providersAttempted).toContain('tavily')
  })

  it('records search.fallback events and exhausted aggregate when all providers fail', async () => {
    // Configure multiple providers so fallback is triggered.
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    process.env.EXA_API_KEY = 'test-exa-key'
    process.env.SEARCH_API = 'tavily'

    // Tavily exhausts on persistent 500.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server error'),
      headers: new Headers()
    })

    // Exa throws a retryable 500 so its retry path also exhausts and the
    // provider loop reaches the `!searchResult` exhausted branch.
    mockExaSearchAndContents.mockImplementation(async () => {
      const err = Object.assign(new Error('Exa down'), { status: 500 })
      throw err
    })

    const { createSearchTool } = await import('@/lib/tools/search')
    const searchTool = createSearchTool('gateway:google/gemini-3-flash')

    const { result: ranResult } = await runInSpan(
      'test-search-fail',
      async () => {
        const iterable = searchTool.execute?.(
          {
            query: 'fail test',
            type: 'optimized',
            content_types: ['web'],
            max_results: 10,
            search_depth: 'basic',
            include_domains: [],
            exclude_domains: []
          },
          { toolCallId: 'tc-2', messages: [] } as any
        )

        if (!iterable || !(Symbol.asyncIterator in iterable)) {
          throw new Error('expected async iterable')
        }
        let caught: unknown = null
        try {
          const iterator = (iterable as AsyncIterable<unknown>)[
            Symbol.asyncIterator
          ]()
          // Drain iterator — any thrown error in the generator surfaces here.

          while (true) {
            const step = await iterator.next()
            if (step.done) break
          }
        } catch (err) {
          caught = err
        }
        return { caught }
      }
    )

    expect(ranResult.caught).toBeInstanceOf(Error)

    const exported = findExportedSpan('test-search-fail')
    expect(exported).toBeDefined()

    // There should be at least one fallback event recorded.
    const fallbackEvents = exported!.events.filter(
      e => e.name === 'search.fallback'
    )
    expect(fallbackEvents.length).toBeGreaterThanOrEqual(1)
    const first = fallbackEvents[0].attributes ?? {}
    expect(typeof first['search.fallback.from']).toBe('string')
    expect(typeof first['search.fallback.to']).toBe('string')
    expect(['transient', 'permanent', 'unknown']).toContain(
      first['search.fallback.reason']
    )

    const attrs = exported!.attributes
    expect(attrs['search.turn.outcome']).toBe('exhausted')
    expect(
      typeof attrs['search.turn.total_fallbacks'] === 'number' &&
        (attrs['search.turn.total_fallbacks'] as number) >= 1
    ).toBe(true)
  })
})
