import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRefreshCarsearchListings = vi.fn()

vi.mock('@/lib/carsearch/refresh', () => ({
  refreshCarsearchListings: () => mockRefreshCarsearchListings()
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn()
}))

import { GET } from '../route'

const ORIGINAL_SECRET = process.env.CRON_SECRET

function makeRequest(authHeader?: string) {
  return new Request('https://example.com/api/carsearch/refresh', {
    headers: authHeader ? { authorization: authHeader } : {}
  })
}

describe('GET /api/carsearch/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('rejects missing bearer token', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(mockRefreshCarsearchListings).not.toHaveBeenCalled()
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(500)
    expect(mockRefreshCarsearchListings).not.toHaveBeenCalled()
  })

  it('runs refresh for a valid cron token', async () => {
    mockRefreshCarsearchListings.mockResolvedValue({
      seenCount: 4,
      insertedCount: 1,
      updatedCount: 3,
      deactivatedCount: 0
    })

    const response = await GET(makeRequest('Bearer test-secret'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.seenCount).toBe(4)
  })

  it('returns 500 when refresh fails', async () => {
    mockRefreshCarsearchListings.mockRejectedValue(new Error('edmunds down'))

    const response = await GET(makeRequest('Bearer test-secret'))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.error).toBe('edmunds down')
  })
})
