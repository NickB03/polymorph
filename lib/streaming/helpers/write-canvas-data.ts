import type { UIMessageStreamWriter } from 'ai'

import type { CanvasEmitter } from '@/lib/canvas/tool-context'
import type {
  CanvasArtifactData,
  CanvasArtifactEventData,
  CanvasArtifactStatusData,
  CanvasDiagnosticsData
} from '@/lib/types/ai'

type StreamWriter = Pick<UIMessageStreamWriter, 'write'>

/**
 * Create a canvas emitter backed by a UIMessageStreamWriter.
 *
 * - `emitCanvasArtifact` and `emitCanvasArtifactStatus` are persisted.
 * - `emitCanvasArtifactEvent` and `emitCanvasDiagnostics` are transient
 *   (not persisted to the database).
 */
export function createCanvasEmitter(writer: StreamWriter): CanvasEmitter {
  return {
    emitCanvasArtifact(data: CanvasArtifactData) {
      writer.write({
        type: 'data-canvasArtifact',
        data
      } as any)
    },

    emitCanvasArtifactStatus(data: CanvasArtifactStatusData) {
      writer.write({
        type: 'data-canvasArtifactStatus',
        data
      } as any)
    },

    emitCanvasArtifactEvent(data: CanvasArtifactEventData) {
      writer.write({
        type: 'data-canvasArtifactEvent',
        data,
        transient: true
      } as any)
    },

    emitCanvasDiagnostics(data: CanvasDiagnosticsData) {
      writer.write({
        type: 'data-canvasDiagnostics',
        data,
        transient: true
      } as any)
    }
  }
}
