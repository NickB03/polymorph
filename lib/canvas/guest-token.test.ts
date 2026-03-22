// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  refreshGuestCanvasToken,
  signGuestCanvasToken,
  verifyGuestCanvasToken
} from './guest-token'

describe('guest canvas tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'))
    process.env.GUEST_CANVAS_SECRET = 'test-secret'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.GUEST_CANVAS_SECRET
  })

  it('signs and verifies a valid token', async () => {
    const token = await signGuestCanvasToken({
      chatId: 'chat-1',
      artifactId: 'art-1'
    })

    const payload = await verifyGuestCanvasToken(token)

    expect(payload).toEqual({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: new Date('2026-03-21T12:30:00.000Z').getTime()
    })
  })

  it('rejects expired tokens', async () => {
    const token = await signGuestCanvasToken({
      chatId: 'chat-1',
      artifactId: 'art-1'
    })

    vi.setSystemTime(new Date('2026-03-21T12:30:00.001Z'))

    await expect(verifyGuestCanvasToken(token)).resolves.toBeNull()
  })

  it('rejects malformed tokens', async () => {
    await expect(verifyGuestCanvasToken('not-a-token')).resolves.toBeNull()
    await expect(verifyGuestCanvasToken('abc.def.ghi')).resolves.toBeNull()
  })

  it('rejects tokens signed with the wrong secret', async () => {
    const token = await signGuestCanvasToken({
      chatId: 'chat-1',
      artifactId: 'art-1'
    })

    process.env.GUEST_CANVAS_SECRET = 'other-secret'

    await expect(verifyGuestCanvasToken(token)).resolves.toBeNull()
  })

  it('refreshes tokens with a new valid expiration', async () => {
    const original = await signGuestCanvasToken({
      chatId: 'chat-1',
      artifactId: 'art-1'
    })

    vi.setSystemTime(new Date('2026-03-21T12:05:00.000Z'))

    const refreshed = await refreshGuestCanvasToken({
      chatId: 'chat-1',
      artifactId: 'art-1'
    })

    expect(refreshed).not.toBe(original)
    await expect(verifyGuestCanvasToken(refreshed)).resolves.toEqual({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: new Date('2026-03-21T12:35:00.000Z').getTime()
    })
  })
})
