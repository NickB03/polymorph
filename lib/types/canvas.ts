export type CanvasArtifactStatus =
  | 'generating'
  | 'compiling'
  | 'ready'
  | 'compile_failed'
  | 'restoring'

export type CanvasVersionCreatedBy = 'ai' | 'user' | 'restore'

export type CanvasDiagnosticSeverity = 'error' | 'warning' | 'info'

export type CanvasDiagnostic = {
  severity: CanvasDiagnosticSeverity
  message: string
  file?: string
  line?: number
  column?: number
  details?: Record<string, unknown>
}

export type CanvasExternalDependency = {
  type: 'image' | 'font' | 'media' | 'api'
  url: string
  label?: string
}

export type CanvasDiagnostics = {
  validation: CanvasDiagnostic[]
  compile: CanvasDiagnostic[]
  runtime: CanvasDiagnostic[]
  externalDependencies: CanvasExternalDependency[]
}

export type CanvasSourceFiles = Record<string, string>

export type CanvasMetaJson = {
  title?: string
  description?: string
  viewport?: string
  assets?: Record<string, { mimeType: string; data: string }>
  externalDependencies?: CanvasExternalDependency[]
}

export type CanvasArtifactRow = {
  id: string
  chatId: string
  userId: string
  title: string
  status: CanvasArtifactStatus
  draftSource: CanvasSourceFiles
  draftCompiledHtml: string | null
  draftDiagnostics: CanvasDiagnostics | null
  draftRevision: number
  currentVersionId: string | null
  lastCompiledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CanvasArtifactVersionRow = {
  id: string
  artifactId: string
  versionNumber: number
  sourceSnapshot: CanvasSourceFiles
  createdBy: CanvasVersionCreatedBy
  createdAt: Date
}

export type LegacyCanvasNotice = {
  kind: 'legacy-unavailable'
  artifactId: string
  source: 'chat-history' | 'public-link' | 'guest-token'
}

export type GuestCanvasTokenPayload = {
  chatId: string
  artifactId: string
  exp: number
}
