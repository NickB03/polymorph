import { eq } from 'drizzle-orm'

import {
  compileCanvasArtifact,
  type CompileCanvasArtifactResult
} from '@/lib/canvas/compiler/compile-canvas-artifact'
import { CANVAS_MAX_VERSIONS } from '@/lib/canvas/constants'
import { validateCanvasSource } from '@/lib/canvas/validation/validate-canvas-source'
import {
  createCanvasArtifact as dbCreateCanvasArtifact,
  createCanvasArtifactVersion as dbCreateCanvasArtifactVersion,
  ensureChatRecord,
  listCanvasArtifactVersions,
  loadCanvasArtifactByChatId,
  loadCanvasArtifactById,
  updateCanvasArtifactDiagnosticsOnly,
  updateCanvasArtifactDraft
} from '@/lib/db/actions'
import { canvasArtifactVersions } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'
import type {
  CanvasArtifactStatus,
  CanvasDiagnostic,
  CanvasDiagnostics,
  CanvasSourceFiles,
  CanvasVersionCreatedBy
} from '@/lib/types/canvas'

// ── Result types ─────────────────────────────────────────────────────

export type CanvasArtifactState = {
  artifactId: string
  chatId: string
  title: string
  status: CanvasArtifactStatus
  draftRevision: number
  draftSource: CanvasSourceFiles
  draftCompiledHtml: string | null
  draftDiagnostics: CanvasDiagnostics | null
  currentVersionId: string | null
  versions: Array<{
    id: string
    versionNumber: number
    createdBy: CanvasVersionCreatedBy
    createdAt: string
  }>
  updatedAt: string
  guestCanvasToken?: string
}

export type CanvasServiceResult = {
  ok: boolean
  artifact?: CanvasArtifactState
  error?: string
  errorCode?:
    | 'stale-revision'
    | 'artifact-already-exists'
    | 'not-found'
    | 'compile-failed'
}

export type CanvasVersionResult = {
  ok: boolean
  artifact?: CanvasArtifactState
  error?: string
  errorCode?: 'not-found' | 'not-ready'
}

export type CanvasExportResult = {
  ok: boolean
  html?: string
  title?: string
  hasExternalDependencies?: boolean
  error?: string
  errorCode?: 'not-found' | 'no-compiled-html'
}

// ── Helpers ──────────────────────────────────────────────────────────

async function buildArtifactState(
  artifactId: string,
  userId?: string | null
): Promise<CanvasArtifactState | null> {
  const artifact = await loadCanvasArtifactById(artifactId, userId)
  if (!artifact) return null

  const versions = await listCanvasArtifactVersions(artifactId, userId)

  return {
    artifactId: artifact.id,
    chatId: artifact.chatId,
    title: artifact.title,
    status: artifact.status as CanvasArtifactStatus,
    draftRevision: artifact.draftRevision,
    draftSource: artifact.draftSource as CanvasSourceFiles,
    draftCompiledHtml: artifact.draftCompiledHtml,
    draftDiagnostics: artifact.draftDiagnostics as CanvasDiagnostics | null,
    currentVersionId: artifact.currentVersionId,
    versions: versions.map(v => ({
      id: v.id,
      versionNumber: v.versionNumber,
      createdBy: v.createdBy as CanvasVersionCreatedBy,
      createdAt: v.createdAt.toISOString()
    })),
    updatedAt: artifact.updatedAt.toISOString()
  }
}

function makeDiagnostics(
  compile: CompileCanvasArtifactResult
): CanvasDiagnostics {
  return {
    validation: [],
    compile: compile.diagnostics,
    runtime: [],
    externalDependencies: compile.externalDependencies
  }
}

function makeValidationDiagnostics(
  diagnostics: CanvasDiagnostic[]
): CanvasDiagnostics {
  return {
    validation: diagnostics,
    compile: [],
    runtime: [],
    externalDependencies: []
  }
}

function logCompileFailure(input: {
  operation: 'create' | 'update' | 'restore'
  artifactId: string
  draftRevision: number
  compileResult: CompileCanvasArtifactResult
}) {
  if (input.compileResult.ok) return

  console.error(
    '[canvas-service]',
    JSON.stringify({
      operation: input.operation,
      artifactId: input.artifactId,
      draftRevision: input.draftRevision,
      firstDiagnostic: input.compileResult.diagnostics[0] ?? null
    })
  )
}

async function getNextVersionNumber(
  artifactId: string,
  userId?: string | null
): Promise<number> {
  const versions = await listCanvasArtifactVersions(artifactId, userId)
  if (versions.length === 0) return 1
  return Math.max(...versions.map(v => v.versionNumber)) + 1
}

async function enforceVersionCap(
  artifactId: string,
  userId?: string | null
): Promise<void> {
  const versions = await listCanvasArtifactVersions(artifactId, userId)
  if (versions.length <= CANVAS_MAX_VERSIONS) return

  // versions are ordered desc by createdAt, so excess are at the end
  const excess = versions.slice(CANVAS_MAX_VERSIONS)
  for (const v of excess) {
    await withOptionalRLS(userId ?? null, async tx => {
      await tx
        .delete(canvasArtifactVersions)
        .where(eq(canvasArtifactVersions.id, v.id))
    })
  }
}

// ── Service methods ──────────────────────────────────────────────────

export async function createCanvasArtifactFromSource(input: {
  chatId: string
  userId: string
  title?: string
  draftSource: CanvasSourceFiles
}): Promise<CanvasServiceResult> {
  // Check for duplicate
  const existing = await loadCanvasArtifactByChatId(input.chatId, input.userId)
  if (existing) {
    const state = await buildArtifactState(existing.id, input.userId)
    return {
      ok: false,
      artifact: state ?? undefined,
      error: 'This chat already has a canvas artifact',
      errorCode: 'artifact-already-exists'
    }
  }

  // Validate source
  const validation = validateCanvasSource(input.draftSource)
  if (!validation.ok) {
    return {
      ok: false,
      error: 'Source validation failed',
      errorCode: 'compile-failed'
    }
  }

  // Ensure the chat row exists (guest/ephemeral sessions may not have one yet).
  // Uses ON CONFLICT DO NOTHING so it is safe for authenticated sessions too.
  await ensureChatRecord({
    id: input.chatId,
    title: input.title ?? 'Untitled',
    userId: input.userId
  })

  // Create DB row with status compiling
  let artifact
  try {
    artifact = await dbCreateCanvasArtifact({
      chatId: input.chatId,
      userId: input.userId,
      title: input.title ?? 'Untitled',
      draftSource: input.draftSource,
      status: 'compiling'
    })
  } catch (err: unknown) {
    // Handle unique constraint violation (race condition on duplicate create)
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.includes('unique') ||
      message.includes('duplicate') ||
      message.includes('23505')
    ) {
      return {
        ok: false,
        error: 'This chat already has a canvas artifact',
        errorCode: 'artifact-already-exists'
      }
    }
    throw err
  }

  // Compile — pass draftRevision so the bootstrap script has a meaningful
  // revisionId for pre-init error messages.
  const compileResult = await compileCanvasArtifact({
    source: input.draftSource,
    artifactId: artifact.id,
    revisionId: String(artifact.draftRevision)
  })

  const status: CanvasArtifactStatus = compileResult.ok
    ? 'ready'
    : 'compile_failed'

  logCompileFailure({
    operation: 'create',
    artifactId: artifact.id,
    draftRevision: artifact.draftRevision,
    compileResult
  })

  // Update draft with compiled result
  await updateCanvasArtifactDraft({
    artifactId: artifact.id,
    expectedRevision: 0,
    draftCompiledHtml: compileResult.html ?? null,
    draftDiagnostics: makeDiagnostics(compileResult),
    status,
    lastCompiledAt: new Date(),
    userId: input.userId
  })

  // Auto-create version on successful compile
  if (compileResult.ok) {
    const versionNumber = 1
    const version = await dbCreateCanvasArtifactVersion({
      artifactId: artifact.id,
      versionNumber,
      sourceSnapshot: input.draftSource,
      createdBy: 'ai',
      userId: input.userId
    })

    // Update currentVersionId (revision is now 1 after the draft update)
    await updateCanvasArtifactDraft({
      artifactId: artifact.id,
      expectedRevision: 1,
      currentVersionId: version.id,
      userId: input.userId
    })
  }

  const state = await buildArtifactState(artifact.id, input.userId)
  return { ok: compileResult.ok, artifact: state ?? undefined }
}

export async function updateCanvasArtifactDraftFromSource(input: {
  artifactId: string
  expectedRevision: number
  draftSource: CanvasSourceFiles
  userId?: string | null
}): Promise<CanvasServiceResult> {
  // Validate source
  const validation = validateCanvasSource(input.draftSource)
  if (!validation.ok) {
    return {
      ok: false,
      error: 'Source validation failed',
      errorCode: 'compile-failed'
    }
  }

  // Persist draft source with optimistic concurrency
  const updated = await updateCanvasArtifactDraft({
    artifactId: input.artifactId,
    expectedRevision: input.expectedRevision,
    draftSource: input.draftSource,
    status: 'compiling',
    userId: input.userId
  })

  if (!updated) {
    return {
      ok: false,
      error: 'Draft revision is stale',
      errorCode: 'stale-revision'
    }
  }

  // Compile
  const compileResult = await compileCanvasArtifact({
    source: input.draftSource,
    artifactId: input.artifactId,
    revisionId: String(updated.draftRevision)
  })

  const status: CanvasArtifactStatus = compileResult.ok
    ? 'ready'
    : 'compile_failed'

  logCompileFailure({
    operation: 'update',
    artifactId: input.artifactId,
    draftRevision: updated.draftRevision,
    compileResult
  })

  // Update with compiled result (revision incremented by first update)
  await updateCanvasArtifactDraft({
    artifactId: input.artifactId,
    expectedRevision: updated.draftRevision,
    draftCompiledHtml: compileResult.html ?? null,
    draftDiagnostics: makeDiagnostics(compileResult),
    status,
    lastCompiledAt: new Date(),
    userId: input.userId
  })

  const state = await buildArtifactState(input.artifactId, input.userId)
  return { ok: compileResult.ok, artifact: state ?? undefined }
}

export async function saveCanvasArtifactVersion(input: {
  artifactId: string
  createdBy: CanvasVersionCreatedBy
  userId?: string | null
}): Promise<CanvasVersionResult> {
  const artifact = await loadCanvasArtifactById(input.artifactId, input.userId)
  if (!artifact) {
    return { ok: false, error: 'Artifact not found', errorCode: 'not-found' }
  }

  if (artifact.status !== 'ready') {
    return {
      ok: false,
      error: 'Cannot create version from a draft that is not ready',
      errorCode: 'not-ready'
    }
  }

  const versionNumber = await getNextVersionNumber(
    input.artifactId,
    input.userId
  )

  const version = await dbCreateCanvasArtifactVersion({
    artifactId: input.artifactId,
    versionNumber,
    sourceSnapshot: artifact.draftSource as CanvasSourceFiles,
    createdBy: input.createdBy,
    userId: input.userId
  })

  // Update currentVersionId
  await updateCanvasArtifactDraft({
    artifactId: input.artifactId,
    expectedRevision: artifact.draftRevision,
    currentVersionId: version.id,
    userId: input.userId
  })

  // Enforce version cap
  await enforceVersionCap(input.artifactId, input.userId)

  const state = await buildArtifactState(input.artifactId, input.userId)
  return { ok: true, artifact: state ?? undefined }
}

export async function restoreCanvasArtifactVersion(input: {
  artifactId: string
  versionId: string
  expectedRevision: number
  userId?: string | null
}): Promise<CanvasServiceResult> {
  // Load the version
  const versions = await listCanvasArtifactVersions(
    input.artifactId,
    input.userId
  )
  const version = versions.find(v => v.id === input.versionId)
  if (!version) {
    return { ok: false, error: 'Version not found', errorCode: 'not-found' }
  }

  // Set status to restoring and replace draft source
  const updated = await updateCanvasArtifactDraft({
    artifactId: input.artifactId,
    expectedRevision: input.expectedRevision,
    draftSource: version.sourceSnapshot as CanvasSourceFiles,
    draftCompiledHtml: null,
    draftDiagnostics: null,
    status: 'restoring',
    userId: input.userId
  })

  if (!updated) {
    return {
      ok: false,
      error: 'Draft revision is stale',
      errorCode: 'stale-revision'
    }
  }

  // Recompile
  const compileResult = await compileCanvasArtifact({
    source: version.sourceSnapshot as CanvasSourceFiles,
    artifactId: input.artifactId,
    revisionId: String(updated.draftRevision)
  })

  const status: CanvasArtifactStatus = compileResult.ok
    ? 'ready'
    : 'compile_failed'

  logCompileFailure({
    operation: 'restore',
    artifactId: input.artifactId,
    draftRevision: updated.draftRevision,
    compileResult
  })

  await updateCanvasArtifactDraft({
    artifactId: input.artifactId,
    expectedRevision: updated.draftRevision,
    draftCompiledHtml: compileResult.html ?? null,
    draftDiagnostics: makeDiagnostics(compileResult),
    status,
    lastCompiledAt: new Date(),
    userId: input.userId
  })

  const state = await buildArtifactState(input.artifactId, input.userId)
  return { ok: compileResult.ok, artifact: state ?? undefined }
}

export async function recordCanvasRuntimeDiagnostics(input: {
  artifactId: string
  draftRevision: number
  diagnostics: CanvasDiagnostic[]
  userId?: string | null
}): Promise<CanvasServiceResult> {
  const artifact = await loadCanvasArtifactById(input.artifactId, input.userId)
  if (!artifact) {
    return { ok: false, error: 'Artifact not found', errorCode: 'not-found' }
  }

  // Only persist if revision matches
  if (artifact.draftRevision !== input.draftRevision) {
    return {
      ok: false,
      error: 'Draft revision does not match',
      errorCode: 'stale-revision'
    }
  }

  const currentDiagnostics =
    (artifact.draftDiagnostics as CanvasDiagnostics | null) ?? {
      validation: [],
      compile: [],
      runtime: [],
      externalDependencies: []
    }

  const updatedDiagnostics: CanvasDiagnostics = {
    ...currentDiagnostics,
    runtime: input.diagnostics
  }

  await updateCanvasArtifactDiagnosticsOnly({
    artifactId: input.artifactId,
    expectedRevision: input.draftRevision,
    draftDiagnostics: updatedDiagnostics,
    userId: input.userId
  })

  const state = await buildArtifactState(input.artifactId, input.userId)
  return { ok: true, artifact: state ?? undefined }
}

export async function loadCanvasArtifactState(input: {
  artifactId: string
  userId?: string | null
}): Promise<CanvasArtifactState | null> {
  return buildArtifactState(input.artifactId, input.userId)
}

export async function exportCanvasArtifactHtml(input: {
  artifactId: string
  userId?: string | null
}): Promise<CanvasExportResult> {
  const artifact = await loadCanvasArtifactById(input.artifactId, input.userId)
  if (!artifact) {
    return { ok: false, error: 'Artifact not found', errorCode: 'not-found' }
  }

  if (!artifact.draftCompiledHtml) {
    return {
      ok: false,
      error: 'No compiled HTML available',
      errorCode: 'no-compiled-html'
    }
  }

  const diagnostics = artifact.draftDiagnostics as CanvasDiagnostics | null
  const hasExternalDependencies =
    (diagnostics?.externalDependencies?.length ?? 0) > 0

  return {
    ok: true,
    html: artifact.draftCompiledHtml,
    title: artifact.title,
    hasExternalDependencies
  }
}
