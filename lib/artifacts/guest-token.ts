import type { ValidatedGuestArtifactHandle } from '@/lib/artifacts/tool-context'

/** Default token time-to-live: 30 minutes. */
const DEFAULT_TTL_MS = 30 * 60 * 1000

/**
 * Token payload encoded inside the signed guest artifact token.
 *
 * Security invariant: the payload is base64url-encoded JSON concatenated
 * with a `.` separator and a base64url-encoded HMAC-SHA256 signature.
 * The signature covers only the first segment (the payload bytes).
 */
interface GuestArtifactTokenPayload {
  artifactId: string
  runtimeSessionId: string
  sandboxId: string
  chatId: string
  expiresAt: number // Unix timestamp (ms)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function base64urlEncode(data: Uint8Array): string {
  return Buffer.from(data).toString('base64url')
}

function base64urlDecode(str: string): Uint8Array {
  // `Buffer.from(...)` is typed as Uint8Array<ArrayBufferLike>, but Web Crypto
  // in TS expects BufferSource backed by ArrayBuffer.
  return Uint8Array.from(Buffer.from(str, 'base64url'))
}

function getSecret(): string {
  const secret = process.env.GUEST_ARTIFACT_SECRET
  if (!secret) {
    throw new Error(
      'GUEST_ARTIFACT_SECRET is not set. Cannot sign guest artifact tokens.'
    )
  }
  return secret
}

function getTtlMs(): number {
  const raw = process.env.GUEST_ARTIFACT_TOKEN_TTL_MS
  if (!raw) return DEFAULT_TTL_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_MS
  return parsed
}

async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a signed guest artifact token.
 *
 * Security invariants:
 * - Uses HMAC-SHA256 via `crypto.subtle.sign`.
 * - Token format: `base64url(JSON.stringify(payload)).base64url(signature)`.
 * - Missing `GUEST_ARTIFACT_SECRET` throws immediately (fail fast).
 * - Token expiry defaults to 30 minutes (configurable via `GUEST_ARTIFACT_TOKEN_TTL_MS`).
 *
 * @throws {Error} if `GUEST_ARTIFACT_SECRET` is not set.
 */
export async function signGuestArtifactToken(
  payload: GuestArtifactTokenPayload
): Promise<string> {
  const secret = getSecret()
  const key = await importKey(secret)
  const encoder = new TextEncoder()
  const payloadJson = JSON.stringify(payload)
  const payloadBytes = encoder.encode(payloadJson)
  const payloadB64 = base64urlEncode(payloadBytes)

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payloadB64)
  )
  const signatureB64 = base64urlEncode(new Uint8Array(signatureBuffer))

  return `${payloadB64}.${signatureB64}`
}

/**
 * Verify a signed guest artifact token and return the validated handle.
 *
 * Security invariants:
 * - Uses `crypto.subtle.verify` with HMAC-SHA256.
 * - Fails closed: any error (malformed, bad signature, expired) returns `null`.
 * - Forged tokens (invalid signature) return `null`.
 * - Expired tokens return `null`.
 * - Missing `GUEST_ARTIFACT_SECRET` returns `null` (fail closed at verify time).
 */
export async function verifyGuestArtifactToken(
  token: string
): Promise<ValidatedGuestArtifactHandle | null> {
  try {
    const secret = process.env.GUEST_ARTIFACT_SECRET
    if (!secret) return null

    const dotIndex = token.indexOf('.')
    if (dotIndex === -1) return null

    const payloadB64 = token.slice(0, dotIndex)
    const signatureB64 = token.slice(dotIndex + 1)
    if (!payloadB64 || !signatureB64) return null

    const key = await importKey(secret)
    const encoder = new TextEncoder()
    const signatureBytes = base64urlDecode(signatureB64)
    const signatureBytesForCrypto = new Uint8Array(signatureBytes.length)
    signatureBytesForCrypto.set(signatureBytes)

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytesForCrypto,
      encoder.encode(payloadB64)
    )
    if (!valid) return null

    const payloadBytes = base64urlDecode(payloadB64)
    const payloadJson = new TextDecoder().decode(payloadBytes)
    const payload: GuestArtifactTokenPayload = JSON.parse(payloadJson)

    // Check expiry
    if (Date.now() >= payload.expiresAt) return null

    return {
      artifactId: payload.artifactId,
      runtimeSessionId: payload.runtimeSessionId,
      sandboxId: payload.sandboxId,
      chatId: payload.chatId,
      expiresAt: new Date(payload.expiresAt)
    }
  } catch {
    // Fail closed: any parse/crypto error returns null
    return null
  }
}

/**
 * Create a new token with refreshed expiry from a validated handle.
 *
 * Security invariants:
 * - Only callable with a previously validated handle (not raw input).
 * - Uses the same HMAC-SHA256 signing as `signGuestArtifactToken`.
 * - New token has a fresh TTL from the current time.
 *
 * @throws {Error} if `GUEST_ARTIFACT_SECRET` is not set.
 */
export async function refreshGuestArtifactToken(
  handle: ValidatedGuestArtifactHandle
): Promise<string> {
  return signGuestArtifactToken({
    artifactId: handle.artifactId,
    runtimeSessionId: handle.runtimeSessionId,
    sandboxId: handle.sandboxId,
    chatId: handle.chatId,
    expiresAt: Date.now() + getTtlMs()
  })
}
