'use client'

import { useEffect, useState } from 'react'

import { AlertCircle, Loader2, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useArtifact, useArtifactAction } from './artifact-context'

export function ArtifactPreviewFrame() {
  const { state, updateWorkspace } = useArtifact()
  const { workspace } = state
  const { previewUrl, status, canRebuild } = workspace
  const [isLoading, setIsLoading] = useState(true)
  const [loadSlow, setLoadSlow] = useState(false)
  const { execute: handleRebuild, isPending: isRebuilding } =
    useArtifactAction('rebuild')
  const { execute: probeRefresh } = useArtifactAction('refresh')

  useEffect(() => {
    if (previewUrl) setIsLoading(true)
  }, [previewUrl])

  // Eager probe: when the workspace opens with status 'ready' and a
  // previewUrl, fire a refresh probe immediately. This catches the common
  // case where the sandbox is dead but E2B returns an error *page* (not a
  // network error), so the iframe loads successfully and isLoading goes
  // false before timeouts fire. The server probe returns the authoritative
  // status and canRebuild flag.
  const [hasProbed, setHasProbed] = useState(false)
  useEffect(() => {
    if (status === 'ready' && previewUrl && !hasProbed) {
      setHasProbed(true)
      probeRefresh()
    }
  }, [status, previewUrl, hasProbed, probeRefresh])

  // Reset probe flag when previewUrl changes (rebuild happened)
  useEffect(() => {
    setHasProbed(false)
  }, [previewUrl])

  // Fallback: if iframe is still loading after 10s, show hint.
  // After 30s hard ceiling, declare expired.
  useEffect(() => {
    if (status !== 'ready' || !previewUrl || !isLoading) return

    let cancelled = false

    const hintTimeout = setTimeout(() => {
      if (!cancelled && isLoading) {
        setLoadSlow(true)
      }
    }, 10_000)

    const ceilingTimeout = setTimeout(() => {
      if (!cancelled && isLoading) {
        updateWorkspace({ status: 'expired' })
      }
    }, 30_000)

    return () => {
      cancelled = true
      clearTimeout(hintTimeout)
      clearTimeout(ceilingTimeout)
    }
  }, [status, previewUrl, isLoading, updateWorkspace])

  // Reset slow-loading state when previewUrl changes (rebuild/refresh)
  useEffect(() => {
    setLoadSlow(false)
  }, [previewUrl])

  const isFailed = status === 'failed'
  const isExpired = status === 'expired'

  if (isFailed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Preview failed</p>
          <p className="text-xs text-muted-foreground">
            The artifact build encountered an error. Try retrying from the
            header.
          </p>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Preview expired</p>
          <p className="text-xs text-muted-foreground">
            {canRebuild
              ? 'The sandbox session has ended. Rebuild to start a fresh preview.'
              : 'This artifact was created before rebuild support was available. Start a new chat to recreate it.'}
          </p>
        </div>
        {canRebuild && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebuild}
            disabled={isRebuilding}
            className="mt-2"
          >
            {isRebuilding ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            {isRebuilding ? 'Rebuilding...' : 'Rebuild'}
          </Button>
        )}
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Preparing preview...</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          {loadSlow && (
            <p className="text-xs text-muted-foreground">
              Still loading — checking sandbox status...
            </p>
          )}
        </div>
      )}
      <iframe
        key={previewUrl}
        src={previewUrl}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        title={workspace.title || 'Artifact preview'}
        onLoad={() => {
          setIsLoading(false)
          setLoadSlow(false)
        }}
        onError={() => {
          updateWorkspace({ status: 'expired' })
        }}
      />
    </div>
  )
}
