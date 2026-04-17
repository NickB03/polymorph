'use client'

import { useEffect, useState } from 'react'

import { AlertCircle, CheckCircle2 } from 'lucide-react'

import type { CanvasCompileProgressPayload } from '@/lib/types/canvas'

import { Button } from '@/components/ui/button'

import { ProgressTracker } from '@/components/tool-ui/progress-tracker/progress-tracker'

type CanvasCompileProgressProps = {
  progress: CanvasCompileProgressPayload
  hasPreview: boolean
  onAskAiToFix?: () => void
}

function getElapsedTime(startedAt: string): number {
  const started = new Date(startedAt).getTime()
  if (Number.isNaN(started)) return 0
  return Math.max(0, Date.now() - started)
}

export function CanvasCompileProgress({
  progress,
  hasPreview,
  onAskAiToFix
}: CanvasCompileProgressProps) {
  // Reset elapsed time when startedAt changes (React's recommended
  // "reset state on prop change" pattern — setState during render is
  // only rendered, not committed, avoiding an extra effect round-trip).
  const [lastStartedAt, setLastStartedAt] = useState(progress.startedAt)
  const [elapsedTime, setElapsedTime] = useState(() =>
    getElapsedTime(progress.startedAt)
  )
  if (progress.startedAt !== lastStartedAt) {
    setLastStartedAt(progress.startedAt)
    setElapsedTime(getElapsedTime(progress.startedAt))
  }

  useEffect(() => {
    if (progress.outcome) {
      return
    }

    const interval = window.setInterval(() => {
      setElapsedTime(getElapsedTime(progress.startedAt))
    }, 100)

    return () => window.clearInterval(interval)
  }, [progress.outcome, progress.startedAt])

  const [choice, setChoice] = useState<
    { outcome: 'success' | 'failed'; summary: string; at: string } | undefined
  >()

  // why: `choice.at` records the wall-clock moment the compile outcome was
  // observed — a timestamp read that must happen at commit time, not during
  // render, so the effect + setState pattern is the correct choice here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (progress.outcome === 'success') {
      setChoice({
        outcome: 'success',
        summary: 'Compiled successfully',
        at: new Date().toISOString()
      })
    } else if (progress.outcome === 'failed') {
      setChoice({
        outcome: 'failed',
        summary: 'Compilation failed',
        at: new Date().toISOString()
      })
    } else {
      setChoice(undefined)
    }
  }, [progress.outcome])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div
      className={[
        'absolute inset-0 z-10 flex items-center justify-center p-6',
        hasPreview ? 'bg-background/68 backdrop-blur-[1px]' : 'bg-background'
      ].join(' ')}
      data-testid="canvas-compile-progress"
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-4">
        <ProgressTracker
          id={`canvas-compile-${progress.artifactId}`}
          role="state"
          steps={progress.steps}
          elapsedTime={elapsedTime}
          choice={choice}
        />

        {progress.outcome === 'success' && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span>Preview is loading…</span>
          </div>
        )}

        {progress.outcome === 'failed' && (
          <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-destructive/20 bg-background/95 p-4 shadow-xs">
            <div className="flex items-start gap-2 text-sm text-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="space-y-1">
                <div className="font-medium">Compilation failed</div>
                <p className="text-muted-foreground">
                  {progress.errorMessage ??
                    'The latest canvas build did not complete.'}
                </p>
              </div>
            </div>
            {onAskAiToFix && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onAskAiToFix}
                >
                  Ask AI to fix
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
