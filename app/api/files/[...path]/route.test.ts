import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentUserId, withOptionalRLS, createSignedDownloadUrl } =
  vi.hoisted(() => ({
    getCurrentUserId: vi.fn(),
    withOptionalRLS: vi.fn(),
    createSignedDownloadUrl: vi.fn()
  }))

vi.mock('@/lib/auth/get-current-user', () => ({ getCurrentUserId }))
vi.mock('@/lib/db/with-rls', () => ({ withOptionalRLS }))
vi.mock('@/lib/supabase/server-storage', () => ({ createSignedDownloadUrl }))

import { GET } from './route'

const PATH = ['user-1', 'chats', 'chat-1', '123-file.pdf']
const SIGNED =
  'https://abc.supabase.co/storage/v1/object/sign/user-uploads/x?token=y'

function get(path: string[] = PATH) {
  return GET(new Request('http://localhost/api/files/' + path.join('/')), {
    params: Promise.resolve({ path })
  })
}

describe('GET /api/files/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSignedDownloadUrl.mockResolvedValue(SIGNED)
  })

  it('redirects the file owner to a signed URL', async () => {
    getCurrentUserId.mockResolvedValue('user-1')
    const res = await get()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(SIGNED)
    expect(withOptionalRLS).not.toHaveBeenCalled()
  })

  it('404s for anonymous access to a private chat attachment', async () => {
    getCurrentUserId.mockResolvedValue(null)
    withOptionalRLS.mockResolvedValue([])
    expect((await get()).status).toBe(404)
    expect(createSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('allows anonymous access when the chat is public and owned by the path owner', async () => {
    getCurrentUserId.mockResolvedValue(null)
    withOptionalRLS.mockResolvedValue([
      { userId: 'user-1', visibility: 'public' }
    ])
    expect((await get()).status).toBe(302)
  })

  it('404s when the public chat belongs to a different user than the path', async () => {
    getCurrentUserId.mockResolvedValue(null)
    withOptionalRLS.mockResolvedValue([
      { userId: 'someone-else', visibility: 'public' }
    ])
    expect((await get()).status).toBe(404)
    expect(createSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('404s on malformed paths without checking anything', async () => {
    getCurrentUserId.mockResolvedValue('user-1')
    expect((await get(['user-1', 'chats', '..', 'x'])).status).toBe(404)
    expect(createSignedDownloadUrl).not.toHaveBeenCalled()
    expect(withOptionalRLS).not.toHaveBeenCalled()
  })

  it('502s when signing fails', async () => {
    getCurrentUserId.mockResolvedValue('user-1')
    createSignedDownloadUrl.mockResolvedValue(null)
    expect((await get()).status).toBe(502)
  })
})
