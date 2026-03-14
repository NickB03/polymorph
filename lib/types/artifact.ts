export type ArtifactStatus =
  | 'building'
  | 'ready'
  | 'failed'
  | 'restarting'
  | 'expired'

export type ArtifactFramework = 'react-spa'
export type ArtifactProvider = 'e2b'

export type ArtifactData = {
  id: string
  title: string
  status: ArtifactStatus
  previewUrl?: string
  revisionId?: string
}

export type ArtifactStatusData = {
  id: string
  status: ArtifactStatus
  previewUrl?: string
  revisionId?: string
}

export interface ArtifactSourceFile {
  path: string
  content: string
  language: string
}

export type ArtifactLogData = {
  artifactId: string
  message: string
  level?: 'info' | 'warn' | 'error'
}

export type ArtifactEventData = {
  artifactId: string
  event: string
  payload?: Record<string, unknown>
}

export interface ArtifactRecord {
  id: string
  chatId: string
  userId: string | null
  currentRevisionId: string | null
  currentRuntimeSessionId: string | null
  title: string
  framework: ArtifactFramework
  status: ArtifactStatus
  createdAt: Date
  updatedAt: Date
}

export interface ArtifactRevisionRecord {
  id: string
  artifactId: string
  triggeringMessageId: string
  promptSummary: string
  title: string
  sandboxSnapshotRef: string | null
  createdAt: Date
}

export interface ArtifactRuntimeSessionRecord {
  id: string
  artifactId: string
  provider: ArtifactProvider
  sandboxId: string
  previewUrl: string | null
  status: ArtifactStatus
  startedAt: Date
  expiresAt: Date | null
  lastHeartbeatAt: Date | null
}

export interface CreateArtifactInput {
  id?: string
  chatId: string
  userId: string | null
  currentRevisionId?: string | null
  currentRuntimeSessionId?: string | null
  title: string
  framework: ArtifactFramework
  status: ArtifactStatus
}

export interface AppendArtifactRevisionInput {
  id?: string
  artifactId: string
  triggeringMessageId: string
  promptSummary: string
  title: string
  sandboxSnapshotRef?: string | null
}

export interface UpsertArtifactRuntimeSessionInput {
  id?: string
  artifactId: string
  provider: ArtifactProvider
  sandboxId: string
  previewUrl?: string | null
  status: ArtifactStatus
  startedAt: Date
  expiresAt?: Date | null
  lastHeartbeatAt?: Date | null
}
