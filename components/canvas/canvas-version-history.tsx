'use client'

import { useCallback, useState } from 'react'

import {
  Download,
  ExternalLink,
  History,
  RotateCcw,
  Save,
  Sparkles
} from 'lucide-react'

import type { CanvasVersionCreatedBy } from '@/lib/types/canvas'
import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { useCanvas } from './canvas-context'

// ── Helpers ──────────────────────────────────────────────────────────

const CREATED_BY_LABELS: Record<CanvasVersionCreatedBy, string> = {
  ai: 'AI',
  user: 'User',
  restore: 'Restore'
}

const CREATED_BY_ICON: Record<
  CanvasVersionCreatedBy,
  React.ComponentType<{ className?: string }>
> = {
  ai: Sparkles,
  user: Save,
  restore: RotateCcw
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

// ── Component ────────────────────────────────────────────────────────

export function CanvasVersionHistory() {
  const canvas = useCanvas()
  const artifact = canvas.artifact

  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ── Save version ──────────────────────────────────────────────────

  const handleSaveVersion = useCallback(async () => {
    setIsSaving(true)
    await canvas.saveVersion()
    setIsSaving(false)
  }, [canvas])

  // ── Restore flow ──────────────────────────────────────────────────

  const handleRestoreClick = useCallback((versionId: string) => {
    // Always show confirmation — plan says if draft is dirty, show confirmation.
    // We show it unconditionally for simplicity (user can always cancel).
    setRestoreTarget(versionId)
  }, [])

  const handleConfirmRestore = useCallback(async () => {
    if (!restoreTarget) return
    setIsRestoring(true)
    await canvas.restoreVersion(restoreTarget)
    setIsRestoring(false)
    setRestoreTarget(null)
  }, [canvas, restoreTarget])

  const handleCancelRestore = useCallback(() => {
    setRestoreTarget(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────

  if (!artifact) return null

  const versions = [...artifact.versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  )

  const diagnostics = artifact.draftDiagnostics
  const externalDeps = diagnostics?.externalDependencies ?? []

  return (
    <div
      className="flex h-full flex-col overflow-auto"
      data-testid="canvas-version-history"
    >
      {/* Save version action */}
      <div className="border-b px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleSaveVersion}
          disabled={artifact.status !== 'ready' || isSaving}
          data-testid="canvas-history-save-version"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {isSaving ? 'Saving...' : 'Save version'}
        </Button>
      </div>

      {/* Version list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {versions.length === 0 ? (
          <div
            className="flex items-center justify-center p-4 text-sm text-muted-foreground"
            data-testid="canvas-history-empty"
          >
            <History className="h-4 w-4 mr-2" />
            No saved versions
          </div>
        ) : (
          <div className="divide-y">
            {versions.map(version => {
              const Icon = CREATED_BY_ICON[version.createdBy]
              const isActive = artifact.currentVersionId === version.id

              return (
                <div
                  key={version.id}
                  className={cn(
                    'flex items-center justify-between px-3 py-2',
                    isActive && 'bg-accent/30'
                  )}
                  data-testid={`canvas-version-${version.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">
                          v{version.versionNumber}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {CREATED_BY_LABELS[version.createdBy]}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {formatTimestamp(version.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleRestoreClick(version.id)}
                    disabled={isRestoring || isActive}
                    data-testid={`canvas-restore-${version.id}`}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <div
          className="border-t bg-destructive/10 px-3 py-3"
          data-testid="canvas-restore-confirmation"
        >
          <p className="text-xs font-medium text-destructive mb-2">
            Unsaved changes will be lost. Are you sure?
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmRestore}
              disabled={isRestoring}
              data-testid="canvas-restore-confirm"
            >
              {isRestoring ? 'Restoring...' : 'Discard draft and restore'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelRestore}
              disabled={isRestoring}
              data-testid="canvas-restore-cancel"
            >
              Cancel restore
            </Button>
          </div>
        </div>
      )}

      {/* External dependencies disclosure — always visible above Export */}
      {externalDeps.length > 0 && (
        <div
          className="border-t px-3 py-2"
          data-testid="canvas-external-dependencies"
        >
          <h4 className="text-xs font-medium mb-1.5">External dependencies</h4>
          <div className="space-y-1">
            {externalDeps.map((dep, i) => (
              <div
                key={`${dep.type}-${dep.url}-${i}`}
                className="flex items-start gap-1.5 text-[11px]"
                data-testid="canvas-external-dep"
              >
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 shrink-0"
                >
                  {dep.type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <span className="break-all">{dep.label ?? dep.url}</span>
                  {dep.label && (
                    <a
                      href={dep.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export HTML */}
      <div className="border-t px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => canvas.exportHtml()}
          disabled={!artifact.draftCompiledHtml}
          data-testid="canvas-history-export"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export HTML
        </Button>
      </div>
    </div>
  )
}
