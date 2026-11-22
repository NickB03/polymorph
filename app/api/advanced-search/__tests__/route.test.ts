import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdvancedSearchResult } from '@/lib/tools/search/advanced-search.test-helpers'

// Mock redis before importing route
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    on: vi.fn()
  }))
}))
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn()
  }))
}))

const advancedSearchMocks = vi.hoisted(() => ({
  runAdvancedSearch: vi.fn()
}))

vi.mock('@/lib/tools/search/advanced-search', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/tools/search/advanced-search')>()

  return {
    ...actual,
    runAdvancedSearch: advancedSearchMocks.runAdvancedSearch
  }
})

const authMocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  checkPerMinuteLimit: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: authMocks.getCurrentUserId
}))
vi.mock('@/lib/rate-limit/per-minute-limiter', () => ({
  checkPerMinuteLimit: authMocks.checkPerMinuteLimit
}))

import { POST } from '../route'

beforeEach(() => {
  vi.unstubAllEnvs()
  advancedSearchMocks.runAdvancedSearch.mockReset()
  authMocks.getCurrentUserId.mockReset().mockResolvedValue('user-1')
  authMocks.checkPerMinuteLimit
    .mockReset()
    .mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0, limit: 10 })
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/advanced-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('POST /api/advanced-search validation', () => {
  it('rejects missing query', async () => {
    const res = await POST(makeRequest({ maxResults: 10 }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('query')
  })

  it('rejects empty query', async () => {
    const res = await POST(makeRequest({ query: '', maxResults: 10 }))
    expect(res.status).toBe(400)
  })

  it('rejects negative maxResults', async () => {
    const res = await POST(makeRequest({ query: 'test', maxResults: -5 }))
    expect(res.status).toBe(400)
  })

  it('rejects maxResults over 100', async () => {
    const res = await POST(makeRequest({ query: 'test', maxResults: 999 }))
    expect(res.status).toBe(400)
  })

  it('rejects invalid searchDepth', async () => {
    const res = await POST(
      makeRequest({ query: 'test', maxResults: 10, searchDepth: 'extreme' })
    )
    expect(res.status).toBe(400)
  })

  it('delegates valid requests to the shared advanced search runner', async () => {
    advancedSearchMocks.runAdvancedSearch.mockResolvedValueOnce(
      createAdvancedSearchResult('Route delegated result')
    )

    const res = await POST(
      makeRequest({
        query: 'test',
        maxResults: 10,
        searchDepth: 'advanced',
        includeDomains: ['example.com'],
        excludeDomains: ['ignore.com']
      })
    )

    expect(advancedSearchMocks.runAdvancedSearch).toHaveBeenCalledWith({
      query: 'test',
      maxResults: 10,
      searchDepth: 'advanced',
      includeDomains: ['example.com'],
      excludeDomains: ['ignore.com']
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.results[0].title).toBe('Route delegated result')
  })
})

describe('POST /api/advanced-search access control', () => {
  it('rejects guests when guest chat is disabled', async () => {
    authMocks.getCurrentUserId.mockResolvedValue(undefined)
    vi.stubEnv('ENABLE_GUEST_CHAT', 'false')

    const res = await POST(makeRequest({ query: 'test' }))

    expect(res.status).toBe(401)
    expect(advancedSearchMocks.runAdvancedSearch).not.toHaveBeenCalled()
  })

  it('rate limits guests by IP when guest chat is enabled', async () => {
    authMocks.getCurrentUserId.mockResolvedValue(undefined)
    vi.stubEnv('ENABLE_GUEST_CHAT', 'true')
    advancedSearchMocks.runAdvancedSearch.mockResolvedValueOnce(
      createAdvancedSearchResult('Guest result')
    )

    const res = await POST(
      new Request('http://localhost/api/advanced-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.7, 10.0.0.1'
        },
        body: JSON.stringify({ query: 'test' })
      })
    )

    expect(res.status).toBe(200)
    expect(authMocks.checkPerMinuteLimit).toHaveBeenCalledWith(
      'advanced-search',
      'guest:203.0.113.7',
      10
    )
  })

  it('returns 429 once the per-minute limit is exceeded', async () => {
    authMocks.checkPerMinuteLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: 0,
      limit: 10
    })

    const res = await POST(makeRequest({ query: 'test' }))

    expect(res.status).toBe(429)
    expect(authMocks.checkPerMinuteLimit).toHaveBeenCalledWith(
      'advanced-search',
      'user-1',
      10
    )
    expect(advancedSearchMocks.runAdvancedSearch).not.toHaveBeenCalled()
  })
})
