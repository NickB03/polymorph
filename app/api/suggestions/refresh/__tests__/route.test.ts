import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateTrendingSuggestions = vi.fn()
const mockSharedInsert = vi.fn((..._args: unknown[]) => {
  throw new Error('shared db must not be used for suggestions refresh')
})
const mockPrivilegedOnConflictDoUpdate = vi.fn()
const mockGetPrivilegedDb = vi.fn(() => ({
  insert: () => ({
    values: () => ({
      onConflictDoUpdate: (...args: unknown[]) =>
        mockPrivilegedOnConflictDoUpdate(...args)
    })
  })
}))

vi.mock('@/lib/agents/generate-trending-suggestions', () => ({
  generateTrendingSuggestions: (...args: unknown[]) =>
    mockGenerateTrendingSuggestions(...args)
}))

vi.mock('@/lib/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockSharedInsert(...args)
  }
}))

vi.mock('@/lib/db/admin', () => ({
  getPrivilegedDb: () => mockGetPrivilegedDb()
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn()
}))

import { GET } from '../route'

const ORIGINAL_SECRET = process.env.CRON_SECRET

function makeRequest(authHeader?: string) {
  return new Request('https://example.com/api/suggestions/refresh', {
    headers: authHeader ? { authorization: authHeader } : {}
  })
}

const SAMPLE_SUGGESTIONS = {
  research: ['r1', 'r2', 'r3', 'r4'],
  compare: ['c1', 'c2', 'c3', 'c4'],
  latest: ['l1', 'l2', 'l3', 'l4'],
  summarize: ['s1', 's2', 's3', 's4'],
  explain: ['e1', 'e2', 'e3', 'e4']
}

describe('GET /api/suggestions/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mockPrivilegedOnConflictDoUpdate.mockResolvedValue({ rowCount: 1 })
  })

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('rejects requests without the bearer token', async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
    expect(mockGenerateTrendingSuggestions).not.toHaveBeenCalled()
  })

  it('rejects requests with the wrong bearer token', async () => {
    const response = await GET(makeRequest('Bearer wrong'))
    expect(response.status).toBe(401)
    expect(mockGenerateTrendingSuggestions).not.toHaveBeenCalled()
  })

  it('returns 500 if CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(makeRequest('Bearer anything'))
    expect(response.status).toBe(500)
    expect(mockGenerateTrendingSuggestions).not.toHaveBeenCalled()
  })

  it('upserts suggestions through the privileged DB helper on success', async () => {
    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: SAMPLE_SUGGESTIONS
    })
    mockPrivilegedOnConflictDoUpdate.mockResolvedValue({ rowCount: 1 })

    const response = await GET(makeRequest('Bearer test-secret'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mockGenerateTrendingSuggestions).toHaveBeenCalledTimes(1)
    expect(mockGetPrivilegedDb).toHaveBeenCalledTimes(1)
    expect(mockPrivilegedOnConflictDoUpdate).toHaveBeenCalledTimes(1)
    expect(mockSharedInsert).not.toHaveBeenCalled()
  })

  it('returns 500 if generation fails', async () => {
    mockGenerateTrendingSuggestions.mockRejectedValue(
      new Error('tavily 402 payment required')
    )

    const response = await GET(makeRequest('Bearer test-secret'))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.error).toContain('tavily')
    expect(mockPrivilegedOnConflictDoUpdate).not.toHaveBeenCalled()
  })

  it('returns 500 if the privileged DB upsert fails', async () => {
    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: SAMPLE_SUGGESTIONS
    })
    mockPrivilegedOnConflictDoUpdate.mockRejectedValueOnce(
      new Error('privileged pg dead')
    )

    const response = await GET(makeRequest('Bearer test-secret'))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.error).toContain('privileged pg dead')
    expect(mockSharedInsert).not.toHaveBeenCalled()
  })
})
