import type { UIMessage } from '@/lib/types/ai'
import type {
  ArtifactData,
  ArtifactEventData,
  ArtifactLogData,
  ArtifactStatusData
} from '@/lib/types/artifact'

/**
 * Validated guest artifact handle extracted from a signed token.
 *
 * Carries both `runtimeSessionId` (our internal session record ID) and
 * `sandboxId` (the E2B-assigned sandbox identifier). These are distinct:
 * runtime operations (restart, destroy) require the provider's `sandboxId`.
 */
export interface ValidatedGuestArtifactHandle {
  artifactId: string
  runtimeSessionId: string
  sandboxId: string
  chatId: string
  expiresAt: Date
}

/**
 * Request-scoped context for artifact tools.
 *
 * Passed via `experimental_context` so tools never read module-global state.
 * Each field is bound to the current request's auth and streaming context.
 */
export interface ArtifactToolContext {
  chatId: string
  userId: string | null
  isGuest: boolean
  messages: UIMessage[]
  triggeringMessageId: string | null

  /** Resolve the guest artifact token from incoming message history */
  resolveGuestArtifactToken(): Promise<ValidatedGuestArtifactHandle | null>

  /** Emit a persistent data-artifact part */
  emitArtifact(data: ArtifactData): void
  /** Emit a persistent data-artifactStatus part */
  emitArtifactStatus(data: ArtifactStatusData): void
  /** Emit a transient data-artifactLog part (stream-only, not persisted) */
  emitArtifactLog(data: ArtifactLogData): void
  /** Emit a transient data-artifactEvent part (stream-only, not persisted) */
  emitArtifactEvent(data: ArtifactEventData): void
}

/**
 * Extract the ArtifactToolContext from a tool's execute context.
 *
 * Returns null if the context is not available (e.g., artifact tools
 * not wired up yet or running in a test without context).
 */
export function getArtifactContext(toolContext: {
  experimental_context?: unknown
}): ArtifactToolContext | null {
  const ctx = toolContext?.experimental_context
  if (ctx && typeof ctx === 'object' && 'artifactToolContext' in ctx) {
    return (ctx as { artifactToolContext: ArtifactToolContext })
      .artifactToolContext
  }
  return null
}
