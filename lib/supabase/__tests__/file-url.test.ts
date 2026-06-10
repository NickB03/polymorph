import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isSafeStoragePath,
  storagePathFromLegacyPublicUrl,
  storagePathFromProxyUrl,
  toProxyFileUrl
} from '../file-url'

const SUPABASE_URL = 'https://abc.supabase.co'
const PATH = 'user-1/chats/chat-1/123-file.pdf'

describe('file-url helpers', () => {
  afterEach(() => vi.unstubAllEnvs())

  describe('isSafeStoragePath', () => {
    it('accepts well-formed storage paths', () => {
      expect(isSafeStoragePath(PATH)).toBe(true)
    })

    it('rejects traversal and malformed paths', () => {
      expect(isSafeStoragePath('user-1/chats/../secrets')).toBe(false)
      expect(isSafeStoragePath('user-1/files/chat-1/a.pdf')).toBe(false)
      expect(isSafeStoragePath('user-1/chats/chat-1')).toBe(false)
      expect(isSafeStoragePath('user-1/chats//a.pdf')).toBe(false)
    })
  })

  describe('storagePathFromProxyUrl', () => {
    it('extracts the storage path from proxy URLs', () => {
      expect(storagePathFromProxyUrl(`/api/files/${PATH}`)).toBe(PATH)
      expect(
        storagePathFromProxyUrl(`http://localhost/api/files/${PATH}`)
      ).toBe(PATH)
    })

    it('returns null for non-proxy or unsafe URLs', () => {
      expect(storagePathFromProxyUrl('/api/other/x')).toBeNull()
      expect(storagePathFromProxyUrl('/api/files/user-1/chats/../x')).toBeNull()
      expect(storagePathFromProxyUrl('https://example.com/file.pdf')).toBeNull()
    })
  })

  describe('storagePathFromLegacyPublicUrl', () => {
    it('maps legacy public URLs on the configured Supabase host', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
      const legacy = `${SUPABASE_URL}/storage/v1/object/public/user-uploads/${PATH}`
      expect(storagePathFromLegacyPublicUrl(legacy)).toBe(PATH)
      expect(toProxyFileUrl(legacy)).toBe(`/api/files/${PATH}`)
    })

    it('ignores legacy-shaped URLs on other hosts', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
      const other = `https://evil.example/storage/v1/object/public/user-uploads/${PATH}`
      expect(storagePathFromLegacyPublicUrl(other)).toBeNull()
      expect(toProxyFileUrl(other)).toBe(other)
    })

    it('returns null when no Supabase URL is configured', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
      const legacy = `${SUPABASE_URL}/storage/v1/object/public/user-uploads/${PATH}`
      expect(storagePathFromLegacyPublicUrl(legacy)).toBeNull()
    })
  })

  it('toProxyFileUrl leaves proxy and external URLs unchanged', () => {
    expect(toProxyFileUrl(`/api/files/${PATH}`)).toBe(`/api/files/${PATH}`)
    expect(toProxyFileUrl('https://example.com/x.png')).toBe(
      'https://example.com/x.png'
    )
  })
})
