import { logArtifactEvent } from '@/lib/artifacts/observability'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import {
  getTemplateId,
  shouldSkipInstall
} from '@/lib/artifacts/runtime/config'
import { readTemplateFiles } from '@/lib/artifacts/templates/read-template'
import * as dbActions from '@/lib/db/actions'

type RebuildInput = {
  artifactId: string
  userId: string | null
  guestSandboxId?: string
}

type RebuildResult =
  | {
      success: true
      previewUrl: string
      sandboxId: string
      runtimeSessionId: string
      status: 'ready'
    }
  | {
      success: false
      error: string
      alreadyInProgress?: true
    }

export async function rebuildArtifactFromRevision(
  input: RebuildInput
): Promise<RebuildResult> {
  const artifact = await dbActions.claimArtifactForRebuild(
    input.artifactId,
    input.userId
  )
  if (!artifact) {
    return {
      success: false,
      error: 'A rebuild is already in progress for this artifact.',
      alreadyInProgress: true
    }
  }

  const revision = await dbActions.loadLatestRevisionWithSource(
    input.artifactId,
    input.userId
  )
  if (!revision?.sourceFiles) {
    await dbActions.updateArtifactRecord(
      { id: artifact.id, status: 'expired' },
      input.userId
    )
    return {
      success: false,
      error:
        'No source files stored for this artifact. It was created before rebuild-on-demand was available.'
    }
  }

  // Preserve the existing session's expiresAt so guest tokens don't get
  // a fresh TTL decoupled from the actual sandbox lifetime.
  const existingSession = await dbActions.loadArtifactRuntimeSession(
    input.artifactId,
    input.userId
  )

  const runtime = createE2BRuntime()
  let sandboxId: string | null = null

  try {
    logArtifactEvent('artifact.rebuild.start', {
      artifactId: artifact.id,
      revisionId: revision.id
    })

    const session = await runtime.createSession({
      templateId: getTemplateId()
    })
    sandboxId = session.sandboxId

    const skipInstall = shouldSkipInstall()

    // When using a custom template, template files are baked into the image —
    // only write model-generated source files. For the base template, merge.
    const files = skipInstall
      ? revision.sourceFiles
      : { ...(await readTemplateFiles()), ...revision.sourceFiles }

    await runtime.writeFiles({ sandboxId, files })

    if (!skipInstall) {
      await runtime.installDependencies({ sandboxId })
    }

    const preview = await runtime.startPreview({ sandboxId })

    const runtimeSession = await dbActions.upsertArtifactRuntimeSession(
      {
        artifactId: artifact.id,
        provider: 'e2b',
        sandboxId,
        previewUrl: preview.previewUrl,
        status: 'ready',
        startedAt: new Date(),
        expiresAt: existingSession?.expiresAt ?? undefined,
        lastHeartbeatAt: new Date()
      },
      input.userId
    )

    logArtifactEvent('artifact.rebuild.complete', {
      artifactId: artifact.id,
      sandboxId,
      revisionId: revision.id
    })

    return {
      success: true,
      previewUrl: preview.previewUrl,
      sandboxId,
      runtimeSessionId: runtimeSession.id,
      status: 'ready'
    }
  } catch (error) {
    if (sandboxId) {
      try {
        await runtime.destroySession({ sandboxId })
      } catch {
        // Best-effort cleanup
      }
    }

    const message = error instanceof Error ? error.message : 'Rebuild failed'

    logArtifactEvent('artifact.rebuild.error', {
      artifactId: artifact.id,
      error: message
    })

    await dbActions.updateArtifactRecord(
      { id: artifact.id, status: 'expired' },
      input.userId
    )

    return { success: false, error: message }
  }
}
