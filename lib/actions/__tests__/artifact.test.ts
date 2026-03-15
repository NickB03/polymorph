import { revalidateTag } from 'next/cache'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type {
  AppendArtifactRevisionInput,
  ArtifactRecord,
  ArtifactRuntimeSessionRecord,
  ArtifactStatus,
  CreateArtifactInput,
  UpsertArtifactRuntimeSessionInput
} from '@/lib/types/artifact'

import {
  appendArtifactRevision,
  createArtifactRecord,
  loadArtifactByChatId,
  upsertArtifactRuntimeSession
} from '../artifact'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(fn => fn)
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn()
}))

vi.mock('@/lib/db/actions')

describe('Artifact Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('loads an artifact by chat id', async () => {
    const artifact: ArtifactRecord = {
      id: 'artifact-1',
      chatId: 'chat-1',
      userId: 'user-1',
      currentRevisionId: 'revision-1',
      currentRuntimeSessionId: 'runtime-1',
      title: 'Pricing page',
      framework: 'react-spa',
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    vi.mocked(dbActions.loadArtifactByChatId).mockResolvedValue(artifact)

    await expect(loadArtifactByChatId('chat-1')).resolves.toEqual(artifact)
    expect(dbActions.loadArtifactByChatId).toHaveBeenCalledWith(
      'chat-1',
      'user-1'
    )
  })

  it('does not load persisted artifacts for unauthenticated users', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(undefined)

    await expect(loadArtifactByChatId('chat-1')).resolves.toBeNull()
    expect(dbActions.loadArtifactByChatId).not.toHaveBeenCalled()
  })

  it('creates an artifact record and invalidates artifact cache tags', async () => {
    const input: CreateArtifactInput = {
      chatId: 'chat-1',
      userId: 'user-1',
      title: 'Landing page',
      framework: 'react-spa',
      status: 'building'
    }
    const artifact: ArtifactRecord = {
      id: 'artifact-1',
      chatId: input.chatId,
      userId: input.userId,
      currentRevisionId: null,
      currentRuntimeSessionId: null,
      title: input.title,
      framework: input.framework,
      status: input.status,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    vi.mocked(dbActions.createArtifactRecord).mockResolvedValue(artifact)

    await expect(createArtifactRecord(input)).resolves.toEqual(artifact)
    expect(dbActions.createArtifactRecord).toHaveBeenCalledWith({
      ...input,
      userId: 'user-1'
    })
    expect(revalidateTag).toHaveBeenCalledWith(`artifact-${artifact.id}`, 'max')
    expect(revalidateTag).toHaveBeenCalledWith(
      `artifact-chat-${artifact.chatId}`,
      'max'
    )
  })

  it('rejects artifact creation for unauthenticated users', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(undefined)

    await expect(
      createArtifactRecord({
        chatId: 'chat-1',
        userId: null,
        title: 'Landing page',
        framework: 'react-spa',
        status: 'building'
      })
    ).rejects.toThrow('User not authenticated')
    expect(dbActions.createArtifactRecord).not.toHaveBeenCalled()
  })

  it('appends an artifact revision and invalidates the artifact cache tags', async () => {
    const input: AppendArtifactRevisionInput = {
      artifactId: 'artifact-1',
      triggeringMessageId: 'message-1',
      promptSummary: 'Add a pricing section',
      title: 'Pricing page'
    }

    const revision = {
      id: 'revision-1',
      artifactId: input.artifactId,
      triggeringMessageId: input.triggeringMessageId,
      promptSummary: input.promptSummary,
      title: input.title,
      sandboxSnapshotRef: null,
      sourceFiles: null,
      createdAt: new Date()
    }

    vi.mocked(dbActions.appendArtifactRevision).mockResolvedValue(revision)

    await expect(appendArtifactRevision(input)).resolves.toEqual(revision)
    expect(dbActions.appendArtifactRevision).toHaveBeenCalledWith(
      input,
      'user-1'
    )
    expect(revalidateTag).toHaveBeenCalledWith(
      `artifact-${input.artifactId}`,
      'max'
    )
  })

  it('upserts a runtime session and invalidates the artifact cache tags', async () => {
    const input: UpsertArtifactRuntimeSessionInput = {
      artifactId: 'artifact-1',
      provider: 'e2b',
      sandboxId: 'sandbox-1',
      previewUrl: 'https://preview.example.com',
      status: 'ready',
      startedAt: new Date('2026-03-13T10:00:00.000Z'),
      expiresAt: new Date('2026-03-13T11:00:00.000Z'),
      lastHeartbeatAt: new Date('2026-03-13T10:30:00.000Z')
    }

    const session: ArtifactRuntimeSessionRecord = {
      id: 'runtime-1',
      artifactId: input.artifactId,
      provider: input.provider,
      sandboxId: input.sandboxId,
      previewUrl: input.previewUrl ?? null,
      status: input.status as ArtifactStatus,
      startedAt: input.startedAt,
      expiresAt: input.expiresAt ?? null,
      lastHeartbeatAt: input.lastHeartbeatAt ?? null
    }

    vi.mocked(dbActions.upsertArtifactRuntimeSession).mockResolvedValue(session)

    await expect(upsertArtifactRuntimeSession(input)).resolves.toEqual(session)
    expect(dbActions.upsertArtifactRuntimeSession).toHaveBeenCalledWith(
      input,
      'user-1'
    )
    expect(revalidateTag).toHaveBeenCalledWith(
      `artifact-${input.artifactId}`,
      'max'
    )
  })
})
