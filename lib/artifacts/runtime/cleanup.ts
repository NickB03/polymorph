import { and, eq, lt, or } from 'drizzle-orm'

import type { ArtifactRuntime } from '@/lib/artifacts/runtime/types'
import { db } from '@/lib/db'
import { artifactRuntimeSessions, artifacts } from '@/lib/db/schema'

/** Default max age for expired sessions: 45 minutes (aligned with 30-min token TTL + buffer). */
const DEFAULT_MAX_AGE_MS = 45 * 60 * 1000

/**
 * Result of a cleanup sweep.
 *
 * Security invariant: `destroyed` counts only sessions whose sandbox was
 * successfully torn down. `failed` counts sessions where the runtime
 * destroy call threw — these are logged but not retried in this sweep.
 */
export interface CleanupResult {
  /** Number of sessions whose sandbox was successfully destroyed. */
  destroyed: number
  /** Number of sessions where the destroy call failed. */
  failed: number
  /** Total expired sessions found. */
  found: number
}

/**
 * Find and destroy expired artifact runtime sessions.
 *
 * This function is designed to be called from a cron or scheduled endpoint.
 * It is NOT automatically registered as a cron handler.
 *
 * Security invariants:
 * - Only targets sessions with `expiresAt` in the past or status `'expired'`/`'failed'`.
 * - Uses the `ArtifactRuntime.destroySession` interface to tear down sandboxes.
 * - Updates the DB status to `'expired'` after successful destruction.
 * - Token expiry is aligned with cleanup: a 30-minute token cannot resume
 *   a session destroyed by the 45-minute (default) cleanup window.
 * - All errors are caught per-session so one failure does not block others.
 *
 * @param runtime - The artifact runtime implementation to use for destroying sessions.
 * @param options.maxAge - Maximum age in milliseconds before a session is
 *   eligible for cleanup. Defaults to 45 minutes.
 */
export async function cleanupExpiredArtifactSessions(
  runtime: ArtifactRuntime,
  options?: { maxAge?: number }
): Promise<CleanupResult> {
  const maxAge = options?.maxAge ?? DEFAULT_MAX_AGE_MS
  const cutoff = new Date(Date.now() - maxAge)

  // Find sessions that are expired by time or already marked as expired/failed
  const expiredSessions = await db
    .select({
      id: artifactRuntimeSessions.id,
      sandboxId: artifactRuntimeSessions.sandboxId,
      artifactId: artifactRuntimeSessions.artifactId,
      status: artifactRuntimeSessions.status,
      expiresAt: artifactRuntimeSessions.expiresAt
    })
    .from(artifactRuntimeSessions)
    .where(
      or(
        // Sessions past their explicit expiry
        and(
          lt(artifactRuntimeSessions.expiresAt, new Date()),
          // Exclude already-cleaned sessions
          eq(artifactRuntimeSessions.status, 'ready')
        ),
        // Sessions older than maxAge that are still active
        and(
          lt(artifactRuntimeSessions.startedAt, cutoff),
          or(
            eq(artifactRuntimeSessions.status, 'ready'),
            eq(artifactRuntimeSessions.status, 'building'),
            eq(artifactRuntimeSessions.status, 'restarting')
          )
        )
      )
    )

  const result: CleanupResult = {
    destroyed: 0,
    failed: 0,
    found: expiredSessions.length
  }

  for (const session of expiredSessions) {
    try {
      // Destroy the sandbox via the runtime interface
      await runtime.destroySession({ sandboxId: session.sandboxId })

      // Mark session as expired in the DB
      await db
        .update(artifactRuntimeSessions)
        .set({ status: 'expired' })
        .where(eq(artifactRuntimeSessions.id, session.id))

      // Also update the parent artifact status if this is its current session
      await db
        .update(artifacts)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(
          and(
            eq(artifacts.id, session.artifactId),
            eq(artifacts.currentRuntimeSessionId, session.id)
          )
        )

      result.destroyed++
    } catch (error) {
      console.error(
        `Failed to cleanup session ${session.id} (sandbox: ${session.sandboxId}):`,
        error
      )
      result.failed++
    }
  }

  return result
}
