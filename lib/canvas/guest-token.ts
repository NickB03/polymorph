import { createHmac, timingSafeEqual } from 'crypto'

import type { GuestCanvasTokenPayload } from '@/lib/types/canvas'

const TTL_MS = 30 * 60 * 1000 // 30 minutes

function getSecret(): string {
  const secret = process.env.GUEST_CANVAS_SECRET
  if (!secret) {
    throw new Error('GUEST_CANVAS_SECRET is not set')
  }
  return secret
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/**
 * Issue a signed guest canvas token for the given chatId + artifactId pair.
 */
export async function signGuestCanvasToken(payload: {
  chatId: string
  artifactId: string
}): Promise<string> {
  const secret = getSecret()
  const tokenPayload: GuestCanvasTokenPayload = {
    chatId: payload.chatId,
    artifactId: payload.artifactId,
    exp: Date.now() + TTL_MS
  }

  const encoded = Buffer.from(JSON.stringify(tokenPayload)).toString(
    'base64url'
  )
  const signature = sign(encoded, secret)

  return `${encoded}.${signature}`
}

/**
 * Verify a signed guest canvas token. Returns the decoded payload if the
 * token is valid and not expired, or `null` otherwise.
 */
export async function verifyGuestCanvasToken(
  token: string
): Promise<GuestCanvasTokenPayload | null> {
  try {
    const secret = getSecret()
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expected = sign(encoded, secret)

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature, 'base64url')
    const expectedBuffer = Buffer.from(expected, 'base64url')
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    ) as GuestCanvasTokenPayload

    // Check expiry
    if (Date.now() > payload.exp) return null

    return payload
  } catch {
    return null
  }
}

/**
 * Issue a fresh token with a new TTL for the same chatId + artifactId pair.
 * Used for token rotation on successful writes.
 */
export async function refreshGuestCanvasToken(payload: {
  chatId: string
  artifactId: string
}): Promise<string> {
  return signGuestCanvasToken(payload)
}
