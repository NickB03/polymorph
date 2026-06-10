import { createHash, timingSafeEqual } from 'crypto'

/**
 * Constant-time comparison for shared secrets. Hashing both inputs first
 * equalizes buffer lengths, so mismatched lengths neither throw nor leak
 * timing information.
 */
export function safeSecretCompare(provided: string, expected: string): boolean {
  const providedHash = createHash('sha256').update(provided).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedHash, expectedHash)
}
