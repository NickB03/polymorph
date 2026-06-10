import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getChatsPage } = vi.hoisted(() => ({ getChatsPage: vi.fn() }))

vi.mock('@/lib/actions/chat', () => ({ getChatsPage }))

import { GET } from './route'

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/chats${query}`)
}

describe('GET /api/chats param clamping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getChatsPage.mockResolvedValue({ chats: [], nextOffset: null })
  })

  it('uses defaults when params are absent', async () => {
    await GET(makeRequest(''))
    expect(getChatsPage).toHaveBeenCalledWith(20, 0)
  })

  it('falls back to defaults on non-numeric values', async () => {
    await GET(makeRequest('?limit=abc&offset=xyz'))
    expect(getChatsPage).toHaveBeenCalledWith(20, 0)
  })

  it('clamps limit to 100 and offset to >= 0', async () => {
    await GET(makeRequest('?limit=99999&offset=-5'))
    expect(getChatsPage).toHaveBeenCalledWith(100, 0)
  })

  it('clamps limit to at least 1', async () => {
    await GET(makeRequest('?limit=0&offset=40'))
    expect(getChatsPage).toHaveBeenCalledWith(1, 40)
  })
})
