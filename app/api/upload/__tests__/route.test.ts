// @vitest-environment node
import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  uploadFileToSupabase: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: mocks.getCurrentUserId
}))
vi.mock('@/lib/supabase/storage', () => ({
  uploadFileToSupabase: mocks.uploadFileToSupabase
}))

import { POST } from '../route'

function makeRequest(chatId: string) {
  const formData = new FormData()
  formData.set('file', new File(['x'], 'a.png', { type: 'image/png' }))
  formData.set('chatId', chatId)
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: formData
  })
}

beforeEach(() => {
  mocks.getCurrentUserId.mockReset().mockResolvedValue('user-1')
  mocks.uploadFileToSupabase.mockReset().mockResolvedValue({ url: '/x' })
})

describe('POST /api/upload chatId validation', () => {
  it.each(['a/b', '..', '../other-user'])(
    'rejects chatId %s before touching storage',
    async chatId => {
      const res = await POST(makeRequest(chatId))

      expect(res.status).toBe(400)
      expect(mocks.uploadFileToSupabase).not.toHaveBeenCalled()
    }
  )

  it('uploads with a well-formed chatId', async () => {
    const res = await POST(makeRequest('chat_1-abc'))

    expect(res.status).toBe(200)
    expect(mocks.uploadFileToSupabase).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'chat_1-abc'
    )
  })
})
