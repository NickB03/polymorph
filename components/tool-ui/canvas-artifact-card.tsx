'use client'

import { Code2, Loader2 } from 'lucide-react'

import type { CanvasArtifactStatus } from '@/lib/types/canvas'

import { Badge } from '@/components/ui/badge'

import { ToolErrorBoundary } from './tool-error-boundary'

// ── Types ────────────────────────────────────────────────────────────

type CanvasArtifactCardData = {
  artifactId: string
  chatId: string
  title: string
  status: CanvasArtifactStatus
  draftRevision: number
  currentVersionId: string | null
}

// ── Status helpers ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  CanvasArtifactStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  generating: { label: 'Generating', variant: 'secondary' },
  compiling: { label: 'Compiling', variant: 'secondary' },
  ready: { label: 'Ready', variant: 'default' },
  compile_failed: { label: 'Error', variant: 'destructive' },
  restoring: { label: 'Restoring', variant: 'secondary' }
}

function isActiveStatus(status: CanvasArtifactStatus): boolean {
  return (
    status === 'generating' || status === 'compiling' || status === 'restoring'
  )
}

// ── Card component ───────────────────────────────────────────────────

function CanvasArtifactCardInner({
  data,
  onClick
}: {
  data: CanvasArtifactCardData
  onClick?: () => void
}) {
  const config = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.ready
  const active = isActiveStatus(data.status)

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
      onClick={onClick}
      data-testid="canvas-artifact-card"
      data-artifact-id={data.artifactId}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        {active ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Code2 className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {data.title || 'Canvas Artifact'}
        </div>
        <div className="text-xs text-muted-foreground">
          Click to open workspace
        </div>
      </div>
      <Badge variant={config.variant} className="shrink-0">
        {config.label}
      </Badge>
    </button>
  )
}

export function CanvasArtifactCard({
  data,
  onClick
}: {
  data: CanvasArtifactCardData
  onClick?: () => void
}) {
  return (
    <ToolErrorBoundary toolName="CanvasArtifactCard">
      <CanvasArtifactCardInner data={data} onClick={onClick} />
    </ToolErrorBoundary>
  )
}

// ── Parsing & tryRender for registry ─────────────────────────────────

/**
 * Parse tool output into CanvasArtifactCardData, or return null.
 * More lenient than tryRenderCanvasArtifactCard — defaults title when
 * absent (createCanvasArtifact output does not include title).
 */
export function tryParseCanvasArtifactCardData(
  output: unknown
): CanvasArtifactCardData | null {
  if (!output || typeof output !== 'object') return null
  const data = output as Record<string, unknown>

  if (
    typeof data.artifactId !== 'string' ||
    typeof data.chatId !== 'string' ||
    typeof data.status !== 'string'
  ) {
    return null
  }

  return {
    artifactId: data.artifactId,
    chatId: data.chatId,
    title: typeof data.title === 'string' ? data.title : 'Canvas Artifact',
    status: data.status as CanvasArtifactStatus,
    draftRevision:
      typeof data.draftRevision === 'number' ? data.draftRevision : 0,
    currentVersionId:
      typeof data.currentVersionId === 'string' ? data.currentVersionId : null
  }
}

/**
 * Attempt to render a canvas artifact card from tool output data.
 * Returns null if the output doesn't match the expected shape.
 */
export function tryRenderCanvasArtifactCard(
  output: unknown,
  onClick?: () => void
): React.ReactNode | null {
  const data = tryParseCanvasArtifactCardData(output)
  if (!data) return null

  return <CanvasArtifactCard data={data} onClick={onClick} />
}
