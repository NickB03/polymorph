import { describe, expect, it } from 'vitest'

import { buildGeneratedImagePath } from '../server-storage'

describe('buildGeneratedImagePath', () => {
  it('constructs path from userId, chatId, and extension', () => {
    const path = buildGeneratedImagePath('user-1', 'chat-1', 'image/png')
    expect(path).toMatch(/^user-1\/chats\/chat-1\/generated-\d+\.png$/)
  })

  it('extracts extension from mediaType', () => {
    const path = buildGeneratedImagePath('u', 'c', 'image/webp')
    expect(path.endsWith('.webp')).toBe(true)
  })

  it('defaults extension from mediaType subtype', () => {
    const path = buildGeneratedImagePath('u', 'c', 'image/jpeg')
    expect(path.endsWith('.jpeg')).toBe(true)
  })

  it('rejects a chatId that could escape the chat folder', () => {
    for (const chatId of ['a/b', '..', '../other-user', '']) {
      expect(() => buildGeneratedImagePath('u', chatId, 'image/png')).toThrow(
        'Invalid chatId'
      )
    }
  })
})
