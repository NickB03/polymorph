'use client'

import { useCallback, useState } from 'react'

import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import { useArtifact } from './artifact-context'

function formatErrorContext(
  logs: { message: string; level?: 'info' | 'warn' | 'error' }[]
): string {
  const tail = logs.slice(-20)
  return tail.map(l => l.message).join('\n')
}

export function ArtifactErrorPanel() {
  const { state, workspaceLogs, updateWorkspace, requestAiFix } = useArtifact()
  const { workspace } = state
  const [isRetrying, setIsRetrying] = useState(false)

  const errorLogs = workspaceLogs.filter(l => l.level === 'error')
  const recentLogs = workspaceLogs.slice(-10)

  const handleRetry = useCallback(async () => {
    if (!workspace.artifactId || isRetrying) return
    setIsRetrying(true)
    try {
      const res = await fetch(
        `/api/artifacts/${workspace.artifactId}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'retry' })
        }
      )
      if (res.ok) {
        const data = await res.json()
        updateWorkspace({
          status: data.status ?? workspace.status,
          previewUrl: data.previewUrl ?? workspace.previewUrl,
          revisionId: data.revisionId ?? workspace.revisionId,
          title: data.title ?? workspace.title
        })
      }
    } finally {
      setIsRetrying(false)
    }
  }, [workspace, isRetrying, updateWorkspace])

  const handleAskAiFix = useCallback(() => {
    if (!requestAiFix) return
    const context = formatErrorContext(workspaceLogs)
    requestAiFix(
      `The artifact build failed with the following error. Please diagnose and fix the source code:\n\n\`\`\`\n${context}\n\`\`\``
    )
  }, [requestAiFix, workspaceLogs])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
      <div className="flex flex-col items-center gap-2 text-center max-w-sm">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="text-sm font-medium">Build Failed</h3>
        <p className="text-xs text-muted-foreground">
          The artifact encountered an error during the build process.
        </p>
      </div>

      {(errorLogs.length > 0 || recentLogs.length > 0) && (
        <div className="w-full max-w-md rounded-lg border bg-muted/30 overflow-hidden">
          <div className="px-3 py-1.5 border-b bg-muted/50">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Recent logs
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto p-2">
            {(errorLogs.length > 0 ? errorLogs.slice(-5) : recentLogs).map(
              (log, i) => (
                <div
                  key={i}
                  className={cn(
                    'font-mono text-[11px] leading-5 px-1 whitespace-pre-wrap break-all',
                    log.level === 'error'
                      ? 'text-destructive'
                      : log.level === 'warn'
                        ? 'text-yellow-600'
                        : 'text-muted-foreground'
                  )}
                >
                  {log.message}
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying || !workspace.artifactId}
        >
          <RotateCcw
            className={cn('h-3.5 w-3.5 mr-1.5', isRetrying && 'animate-spin')}
          />
          Retry
        </Button>
        {requestAiFix && (
          <Button variant="default" size="sm" onClick={handleAskAiFix}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Ask AI to fix
          </Button>
        )}
      </div>
    </div>
  )
}
