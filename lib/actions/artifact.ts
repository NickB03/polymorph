'use server'

import { revalidateTag, unstable_cache } from 'next/cache'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type {
  AppendArtifactRevisionInput,
  CreateArtifactInput,
  UpsertArtifactRuntimeSessionInput
} from '@/lib/types/artifact'

const getCachedArtifactByChatId = (chatId: string, userId: string) => {
  const cachedFunction = unstable_cache(
    async () => dbActions.loadArtifactByChatId(chatId, userId),
    ['artifact-by-chat', chatId, userId],
    {
      tags: ['artifact', `artifact-chat-${chatId}`],
      revalidate: 60
    }
  )

  return cachedFunction()
}

export async function loadArtifactByChatId(chatId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  return getCachedArtifactByChatId(chatId, userId)
}

export async function createArtifactRecord(input: CreateArtifactInput) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const artifact = await dbActions.createArtifactRecord({
    ...input,
    userId
  })

  revalidateTag('artifact', 'max')
  revalidateTag(`artifact-${artifact.id}`, 'max')
  revalidateTag(`artifact-chat-${artifact.chatId}`, 'max')

  return artifact
}

export async function appendArtifactRevision(
  input: AppendArtifactRevisionInput
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const revision = await dbActions.appendArtifactRevision(input, userId)

  revalidateTag('artifact', 'max')
  revalidateTag(`artifact-${input.artifactId}`, 'max')

  return revision
}

export async function upsertArtifactRuntimeSession(
  input: UpsertArtifactRuntimeSessionInput
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const session = await dbActions.upsertArtifactRuntimeSession(input, userId)

  revalidateTag('artifact', 'max')
  revalidateTag(`artifact-${input.artifactId}`, 'max')

  return session
}
