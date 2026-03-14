import type { UIMessageStreamWriter } from 'ai'

import type { UIMessage } from '@/lib/types/ai'
import type {
  ArtifactData,
  ArtifactEventData,
  ArtifactLogData,
  ArtifactStatusData
} from '@/lib/types/artifact'

/**
 * Artifact stream emitter functions.
 *
 * These match the emit signatures on ArtifactToolContext so the
 * emitter can be spread directly into the context object.
 */
export interface ArtifactEmitter {
  emitArtifact(data: ArtifactData): void
  emitArtifactStatus(data: ArtifactStatusData): void
  emitArtifactLog(data: ArtifactLogData): void
  emitArtifactEvent(data: ArtifactEventData): void
}

/**
 * Create a writer-backed artifact emitter.
 *
 * This is the only way artifact tools should emit streamed state.
 *
 * Persistent parts (`data-artifact`, `data-artifactStatus`) are written
 * as standard data chunks and stored by the message-mapping layer.
 *
 * Transient parts (`data-artifactLog`, `data-artifactEvent`) are written
 * with `transient: true` so they are consumed via `useChat({ onData })`
 * but never persisted to `message.parts`.
 */
export function createArtifactEmitter(
  writer: UIMessageStreamWriter<UIMessage>
): ArtifactEmitter {
  return {
    emitArtifact(data: ArtifactData): void {
      writer.write({
        type: 'data-artifact',
        data
      })
    },

    emitArtifactStatus(data: ArtifactStatusData): void {
      writer.write({
        type: 'data-artifactStatus',
        data
      })
    },

    emitArtifactLog(data: ArtifactLogData): void {
      writer.write({
        type: 'data-artifactLog',
        data,
        transient: true
      })
    },

    emitArtifactEvent(data: ArtifactEventData): void {
      writer.write({
        type: 'data-artifactEvent',
        data,
        transient: true
      })
    }
  }
}
