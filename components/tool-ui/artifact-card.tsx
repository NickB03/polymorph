'use client'

import { memo } from 'react'

import {
  AppWindow,
  CheckCircle2,
  Loader2,
  RotateCw,
  Timer,
  XCircle
} from 'lucide-react'

import type { ArtifactData, ArtifactStatus } from '@/lib/types/artifact'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import { useArtifact } from '@/components/artifact/artifact-context'

import { ToolErrorBoundary } from './tool-error-boundary'

const statusConfig: Record<
  ArtifactStatus,
  {
    label: string
    icon: typeof Loader2
    iconColor: string
    animate?: boolean
  }
> = {
  building: {
    label: 'Building',
    icon: Loader2,
    iconColor: 'text-blue-600 dark:text-blue-400',
    animate: true
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400'
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    iconColor: 'text-red-600 dark:text-red-400'
  },
  restarting: {
    label: 'Restarting',
    icon: RotateCw,
    iconColor: 'text-amber-600 dark:text-amber-400',
    animate: true
  },
  expired: {
    label: 'Expired',
    icon: Timer,
    iconColor: 'text-slate-600 dark:text-slate-400'
  }
}

function isArtifactData(value: unknown): value is ArtifactData {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.status === 'string' &&
    obj.status in statusConfig
  )
}

const ArtifactCardInner = memo(function ArtifactCardInner({
  data
}: {
  data: ArtifactData
}) {
  const { openWorkspace, state } = useArtifact()
  const config = statusConfig[data.status]
  const StatusIcon = config.icon

  const isAlreadyOpen = state.workspace.artifactId === data.id

  const handleOpen = () => {
    openWorkspace({
      artifactId: data.id,
      title: data.title,
      status: data.status,
      previewUrl: data.previewUrl,
      revisionId: data.revisionId,
      guestArtifactToken: data.guestArtifactToken ?? null
    })
  }

  return (
    <div className="flex w-full items-center gap-3.5 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-xs">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <AppWindow className="size-5 text-muted-foreground" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{data.title}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          App
          <span className="text-muted-foreground/40">·</span>
          <StatusIcon
            className={cn(
              'size-3',
              config.iconColor,
              config.animate && 'animate-spin'
            )}
          />
          <span className={cn('text-xs', config.iconColor)}>
            {config.label}
          </span>
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="shrink-0 text-xs"
        onClick={handleOpen}
        disabled={isAlreadyOpen}
      >
        {isAlreadyOpen ? 'Viewing' : 'Open App'}
      </Button>
    </div>
  )
})

export function tryRenderArtifactCard(data: unknown) {
  if (!isArtifactData(data)) return null
  return (
    <ToolErrorBoundary toolName="ArtifactCard">
      <ArtifactCardInner data={data} />
    </ToolErrorBoundary>
  )
}
