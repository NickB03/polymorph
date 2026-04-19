import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateTrendingSuggestions = vi.fn()
const mockOnConflictDoUpdate = vi.fn()

vi.mock('@/lib/agents/generate-trending-suggestions', () => ({
  generateTrendingSuggestions: (...args: unknown[]) =>
    mockGenerateTrendingSuggestions(...args)
}))

vi.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: (...args: unknown[]) =>
          mockOnConflictDoUpdate(...args)
      })
    })
  }
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
    mockOnConflictDoUpdate.mockResolvedValue({ rowCount: 1 })
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

  it('upserts suggestions on success', async () => {
    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: SAMPLE_SUGGESTIONS
    })

    const response = await GET(makeRequest('Bearer test-secret'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mockGenerateTrendingSuggestions).toHaveBeenCalledTimes(1)
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1)
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
    expect(mockOnConflictDoUpdate).not.toHaveBeenCalled()
  })

  it('returns 500 if the DB upsert fails', async () => {
    mockGenerateTrendingSuggestions.mockResolvedValue({
      suggestions: SAMPLE_SUGGESTIONS
    })
    mockOnConflictDoUpdate.mockRejectedValueOnce(new Error('pg dead'))

    const response = await GET(makeRequest('Bearer test-secret'))
    expect(response.status).toBe(500)
  })
})
