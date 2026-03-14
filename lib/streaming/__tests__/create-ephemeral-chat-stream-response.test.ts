import { beforeEach, describe, expect, it } from 'vitest'

import {
  refreshGuestArtifactToken,
  signGuestArtifactToken,
  verifyGuestArtifactToken
} from '@/lib/artifacts/guest-token'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'

function makeModel() {
  return { providerId: 'openai', id: 'gpt-4o-mini' } as any
}

describe('createEphemeralChatStreamResponse', () => {
  it('returns 400 when messages are missing', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: [],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed'
    })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({
      code: 'BAD_REQUEST',
      error: 'messages are required'
    })
  })

  it('returns 400 when messages is undefined-ish (null cast)', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: null as unknown as any[],
      model: makeModel(),
      abortSignal: new AbortController().signal,
      searchMode: 'chat',
      modelType: 'speed'
    })

    expect(response.status).toBe(400)
  })

  describe('guest artifact continuity rejection', () => {
    // The ephemeral stream does not persist messages or authenticate users.
    // Guest artifact continuity relies on messages passed inline. If the
    // messages array is empty (meaning the token or history was lost/forged),
    // the stream correctly rejects with 400.

    it('rejects when guest provides no conversation history (expired/lost token)', async () => {
      const response = await createEphemeralChatStreamResponse({
        messages: [],
        model: makeModel(),
        abortSignal: new AbortController().signal,
        searchMode: 'chat',
        modelType: 'speed',
        chatId: 'ghost-chat-id',
        trigger: 'tool-result'
      })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('messages are required')
    })

    it('rejects when messages array contains no entries', async () => {
      const response = await createEphemeralChatStreamResponse({
        messages: [],
        model: makeModel(),
        abortSignal: new AbortController().signal,
        searchMode: 'chat',
        modelType: 'speed',
        trigger: 'submit-message'
      })

      expect(response.status).toBe(400)
    })
  })
})

describe('guest artifact token security', () => {
  const TEST_SECRET = 'test-secret-for-hmac-signing-32chars!'

  beforeEach(() => {
    process.env.GUEST_ARTIFACT_SECRET = TEST_SECRET
    delete process.env.GUEST_ARTIFACT_TOKEN_TTL_MS
  })

  describe('signGuestArtifactToken + verifyGuestArtifactToken', () => {
    it('round-trips a valid token', async () => {
      const token = await signGuestArtifactToken({
        artifactId: 'art-1',
        runtimeSessionId: 'sess-1',
        sandboxId: 'sbx-1',
        expiresAt: Date.now() + 60_000
      })

      const handle = await verifyGuestArtifactToken(token)
      expect(handle).not.toBeNull()
      expect(handle?.artifactId).toBe('art-1')
      expect(handle?.runtimeSessionId).toBe('sess-1')
      expect(handle?.sandboxId).toBe('sbx-1')
    })

    it('rejects forged tokens (bad signature)', async () => {
      const token = await signGuestArtifactToken({
        artifactId: 'art-1',
        runtimeSessionId: 'sess-1',
        sandboxId: 'sbx-1',
        expiresAt: Date.now() + 60_000
      })

      // Tamper with the signature segment
      const parts = token.split('.')
      const tamperedToken = `${parts[0]}.AAAA${parts[1].slice(4)}`

      const handle = await verifyGuestArtifactToken(tamperedToken)
      expect(handle).toBeNull()
    })

    it('rejects expired tokens', async () => {
      const token = await signGuestArtifactToken({
        artifactId: 'art-1',
        runtimeSessionId: 'sess-1',
        sandboxId: 'sbx-1',
        expiresAt: Date.now() - 1000 // already expired
      })

      const handle = await verifyGuestArtifactToken(token)
      expect(handle).toBeNull()
    })

    it('rejects tokens when secret is missing at verify time', async () => {
      const token = await signGuestArtifactToken({
        artifactId: 'art-1',
        runtimeSessionId: 'sess-1',
        sandboxId: 'sbx-1',
        expiresAt: Date.now() + 60_000
      })

      delete process.env.GUEST_ARTIFACT_SECRET
      const handle = await verifyGuestArtifactToken(token)
      expect(handle).toBeNull()
    })

    it('throws when secret is missing at sign time', async () => {
      delete process.env.GUEST_ARTIFACT_SECRET
      await expect(
        signGuestArtifactToken({
          artifactId: 'art-1',
          runtimeSessionId: 'sess-1',
          sandboxId: 'sbx-1',
          expiresAt: Date.now() + 60_000
        })
      ).rejects.toThrow('GUEST_ARTIFACT_SECRET')
    })

    it('rejects completely malformed tokens', async () => {
      expect(await verifyGuestArtifactToken('')).toBeNull()
      expect(await verifyGuestArtifactToken('not-a-token')).toBeNull()
      expect(await verifyGuestArtifactToken('a.b.c')).toBeNull()
      expect(await verifyGuestArtifactToken('.')).toBeNull()
    })

    it('rejects tokens signed with a different secret', async () => {
      const token = await signGuestArtifactToken({
        artifactId: 'art-1',
        runtimeSessionId: 'sess-1',
        sandboxId: 'sbx-1',
        expiresAt: Date.now() + 60_000
      })

      // Change the secret
      process.env.GUEST_ARTIFACT_SECRET = 'different-secret-key-entirely!'
      const handle = await verifyGuestArtifactToken(token)
      expect(handle).toBeNull()
    })
  })

  describe('refreshGuestArtifactToken', () => {
    it('produces a valid token with refreshed expiry', async () => {
      const handle = {
        artifactId: 'art-1',
        runtimeSessionId: 'sess-1',
        sandboxId: 'sandbox-1',
        chatId: 'art-1',
        expiresAt: new Date(Date.now() + 5_000) // about to expire
      }

      const refreshed = await refreshGuestArtifactToken(handle)
      const verified = await verifyGuestArtifactToken(refreshed)

      expect(verified).not.toBeNull()
      expect(verified?.artifactId).toBe('art-1')
      expect(verified?.runtimeSessionId).toBe('sess-1')
      expect(verified?.sandboxId).toBe('sandbox-1')
      // Refreshed expiry should be further in the future than the original
      expect(verified!.expiresAt.getTime()).toBeGreaterThan(
        handle.expiresAt.getTime()
      )
    })

    it('preserves sandboxId distinct from runtimeSessionId through refresh', async () => {
      const token = await signGuestArtifactToken({
        artifactId: 'art-2',
        runtimeSessionId: 'sess-2',
        sandboxId: 'sbx-e2b-abc123',
        expiresAt: Date.now() + 60_000
      })

      const handle = await verifyGuestArtifactToken(token)
      expect(handle).not.toBeNull()
      expect(handle!.runtimeSessionId).toBe('sess-2')
      expect(handle!.sandboxId).toBe('sbx-e2b-abc123')

      // Refresh and re-verify: sandboxId must survive the cycle
      const refreshed = await refreshGuestArtifactToken(handle!)
      const refreshedHandle = await verifyGuestArtifactToken(refreshed)
      expect(refreshedHandle).not.toBeNull()
      expect(refreshedHandle!.runtimeSessionId).toBe('sess-2')
      expect(refreshedHandle!.sandboxId).toBe('sbx-e2b-abc123')
    })
  })
})
