'use client'

import { AlertCircle, Loader2 } from 'lucide-react'

import { useArtifact } from './artifact-context'

export function ArtifactPreviewFrame() {
  const { state } = useArtifact()
  const { workspace } = state
  const { previewUrl, status } = workspace

  const isFailed = status === 'failed'
  const isExpired = status === 'expired'

  if (isFailed || isExpired) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isFailed ? 'Preview failed' : 'Preview expired'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isFailed
              ? 'The artifact build encountered an error. Try retrying from the header.'
              : 'This preview session has expired. Refresh to start a new one.'}
          </p>
        </div>
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
    <iframe
      src={previewUrl}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      title={workspace.title || 'Artifact preview'}
    />
  )
}
