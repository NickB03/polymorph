import { describe, expect, it, vi } from 'vitest'

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

import { POST } from '../route'

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
})
