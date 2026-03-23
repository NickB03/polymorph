import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the fetch schema before importing the module
vi.mock('@/lib/schema/fetch', () => ({
  fetchSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      type: { type: 'string', enum: ['regular', 'api'], default: 'regular' }
    },
    required: ['url']
  }
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
const originalEnv = { ...process.env }

// Must import after mocks
const { fetchTool } = await import('../fetch')

async function collectStreamResults(
  params: { url: string; type: 'regular' | 'api' },
  context?: any
) {
  const results: any[] = []
  const execute = fetchTool.execute
  if (!execute) throw new Error('No execute function')

  const stream = execute(
    params,
    context || { toolCallId: 'test', messages: [] }
  )
  if (stream && Symbol.asyncIterator in (stream as any)) {
    for await (const chunk of stream as AsyncIterable<any>) {
      results.push(chunk)
    }
  }
  return results
}

describe('fetchTool - regular mode', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('yields fetching state then complete state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () =>
        Promise.resolve(
          '<html><title>Test Page</title><body>Hello world</body></html>'
        )
    })

    const results = await collectStreamResults({
      url: 'https://example.com',
      type: 'regular'
    })

    expect(results[0]).toEqual({
      state: 'fetching',
      url: 'https://example.com'
    })
    expect(results[1].state).toBe('complete')
    expect(results[1].results[0].title).toBe('Test Page')
    expect(results[1].results[0].content).toContain('Hello world')
  })

  it('strips script and style tags from content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () =>
        Promise.resolve(
          '<html><head><style>body{color:red}</style></head><body><script>alert("xss")</script>Clean content</body></html>'
        )
    })

    const results = await collectStreamResults({
      url: 'https://example.com',
      type: 'regular'
    })
    const content = results[1].results[0].content
    expect(content).not.toContain('alert')
    expect(content).not.toContain('color:red')
    expect(content).toContain('Clean content')
  })

  it('replaces img tags with alt text markers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () =>
        Promise.resolve(
          '<html><title>T</title><body><img alt="A cute cat" src="cat.jpg"> text</body></html>'
        )
    })

    const results = await collectStreamResults({
      url: 'https://example.com',
      type: 'regular'
    })
    expect(results[1].results[0].content).toContain('[IMAGE: A cute cat]')
  })

  it('truncates content at 50000 characters', async () => {
    const longContent = 'x'.repeat(60000)
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () =>
        Promise.resolve(
          `<html><title>T</title><body>${longContent}</body></html>`
        )
    })

    const results = await collectStreamResults({
      url: 'https://example.com',
      type: 'regular'
    })
    const content = results[1].results[0].content
    expect(content.length).toBeLessThanOrEqual(50000 + 15) // plus "...[truncated]"
    expect(content).toContain('...[truncated]')
  })

  it('truncates long titles at 100 characters', async () => {
    const longTitle = 'A'.repeat(150)
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () =>
        Promise.resolve(
          `<html><title>${longTitle}</title><body>content</body></html>`
        )
    })

    const results = await collectStreamResults({
      url: 'https://example.com',
      type: 'regular'
    })
    expect(results[1].results[0].title.length).toBeLessThanOrEqual(103) // 100 + "..."
  })

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers()
    })

    await expect(
      collectStreamResults({
        url: 'https://example.com/missing',
        type: 'regular'
      })
    ).rejects.toThrow('HTTP 404')
  })

  it('throws on unsupported content type', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      text: () => Promise.resolve('')
    })

    await expect(
      collectStreamResults({
        url: 'https://example.com/file.pdf',
        type: 'regular'
      })
    ).rejects.toThrow('Unsupported content type')
  })

  it('throws timeout error on abort', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValue(abortError)

    await expect(
      collectStreamResults({ url: 'https://example.com', type: 'regular' })
    ).rejects.toThrow('Request timeout after 10 seconds')
  })

  it('returns early when abort signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const results = await collectStreamResults(
      { url: 'https://example.com', type: 'regular' },
      { toolCallId: 'test', messages: [], abortSignal: controller.signal }
    )
    // Should only have fetching state, then return
    expect(results).toHaveLength(1)
    expect(results[0].state).toBe('fetching')
  })
})

describe('fetchTool - API mode', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    delete process.env.JINA_API_KEY
    delete process.env.TAVILY_API_KEY
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses Jina Reader when JINA_API_KEY is set', async () => {
    process.env.JINA_API_KEY = 'test-jina-key'
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            title: 'Jina Title',
            content: 'Jina content',
            url: 'https://example.com'
          }
        })
    })

    const results = await collectStreamResults({
      url: 'https://example.com',
      type: 'api'
    })

    expect(results[1].state).toBe('complete')
    expect(results[1].results[0].title).toBe('Jina Title')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://r.jina.ai/https://example.com',
      expect.any(Object)
    )

    delete process.env.JINA_API_KEY
  })

  it('falls back to Tavily Extract when no Jina key', async () => {
    delete process.env.JINA_API_KEY
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              raw_content: 'Tavily extracted content',
              url: 'https://example.com'
            }
          ]
        })
    })

    const results = await collectStreamResults({
      url: 'https://example.com',
      type: 'api'
    })

    expect(results[1].state).toBe('complete')
    expect(results[1].results[0].content).toBe('Tavily extracted content')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.tavily.com/extract',
      expect.any(Object)
    )
  })

  it('surfaces Jina Reader provider errors', async () => {
    process.env.JINA_API_KEY = 'test-jina-key'
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: () => Promise.resolve('Rate limit exceeded')
    })

    await expect(
      collectStreamResults({
        url: 'https://example.com/article.pdf',
        type: 'api'
      })
    ).rejects.toThrow('Jina Reader error 429')
  })

  it('surfaces Tavily extract quota errors', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 432,
      statusText: 'Request Failed',
      text: () =>
        Promise.resolve(
          JSON.stringify({
            detail: { error: 'Plan usage limit exceeded' }
          })
        )
    })

    await expect(
      collectStreamResults({
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11494604.pdf',
        type: 'api'
      })
    ).rejects.toThrow('Tavily extract error 432')
  })

  it('throws when Tavily extract returns empty results', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: []
        })
    })

    await expect(
      collectStreamResults({
        url: 'https://example.com/article.pdf',
        type: 'api'
      })
    ).rejects.toThrow('No results returned from content extraction service')
  })

  it('falls back to regular fetch for recoverable HTML extractor failures', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 432,
        statusText: 'Request Failed',
        text: () =>
          Promise.resolve(
            JSON.stringify({
              detail: { error: 'Plan usage limit exceeded' }
            })
          )
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () =>
          Promise.resolve(
            '<html><title>Recovered Page</title><body>Recovered content</body></html>'
          )
      })

    const results = await collectStreamResults({
      url: 'https://example.com/article',
      type: 'api'
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(results[1].results[0].title).toBe('Recovered Page')
    expect(results[1].results[0].content).toContain('Recovered content')
  })

  it('does not fall back to regular fetch for PDF URLs', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key'
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: () => Promise.resolve('Rate limit exceeded')
    })

    await expect(
      collectStreamResults({
        url: 'https://example.com/report.pdf',
        type: 'api'
      })
    ).rejects.toThrow('Tavily extract error 429')

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
