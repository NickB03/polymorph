'use client'

import { useEffect, useRef } from 'react'

import { ScrollText } from 'lucide-react'

import type { ArtifactLogData } from '@/lib/types/artifact'
import { cn } from '@/lib/utils'

import { useArtifact } from './artifact-context'

function LogEntry({ log }: { log: ArtifactLogData }) {
  const levelClass =
    log.level === 'error'
      ? 'text-red-500'
      : log.level === 'warn'
        ? 'text-yellow-600'
        : 'text-muted-foreground'

  return (
    <div
      className={cn(
        'px-3 py-0.5 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all',
        levelClass
      )}
    >
      {log.message}
    </div>
  )
}

export function ArtifactLogsPanel() {
  const { workspaceLogs } = useArtifact()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [workspaceLogs.length])

  if (workspaceLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
        <ScrollText className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          Build logs will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/30 py-2">
      {workspaceLogs.map((log, i) => (
        <LogEntry key={i} log={log} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
