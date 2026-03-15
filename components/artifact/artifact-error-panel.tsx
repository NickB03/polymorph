'use client'

import { useCallback } from 'react'

import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import {
  formatArtifactFixPrompt,
  useArtifact,
  useArtifactAction
} from './artifact-context'

export function ArtifactErrorPanel() {
  const { state, workspaceLogs, requestAiFix } = useArtifact()
  const { workspace } = state
  const { execute: handleRetry, isPending: isRetrying } =
    useArtifactAction('retry')

  const errorLogs = workspaceLogs.filter(l => l.level === 'error')
  const recentLogs = workspaceLogs.slice(-10)

  const handleAskAiFix = useCallback(() => {
    if (!requestAiFix) return
    requestAiFix(formatArtifactFixPrompt(workspaceLogs))
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
