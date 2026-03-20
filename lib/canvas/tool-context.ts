import type {
  CanvasArtifactData,
  CanvasArtifactEventData,
  CanvasArtifactStatusData,
  CanvasDiagnosticsData
} from '@/lib/types/ai'
import type { CanvasSourceFiles } from '@/lib/types/canvas'

export type CurrentCanvasArtifact = {
  artifactId: string
  draftSource: CanvasSourceFiles
  draftRevision: number
}

export type CanvasToolContext = {
  chatId: string
  userId: string
  isGuest: boolean
  guestCanvasToken?: string
  emitter: CanvasEmitter
  currentArtifact?: CurrentCanvasArtifact
}

export type CanvasEmitter = {
  emitCanvasArtifact: (data: CanvasArtifactData) => void
  emitCanvasArtifactStatus: (data: CanvasArtifactStatusData) => void
  emitCanvasArtifactEvent: (data: CanvasArtifactEventData) => void
  emitCanvasDiagnostics: (data: CanvasDiagnosticsData) => void
}
