'use client'

import { memo } from 'react'

import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCw,
  Timer,
  XCircle
} from 'lucide-react'

import type { ArtifactData, ArtifactStatus } from '@/lib/types/artifact'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { useArtifact } from '@/components/artifact/artifact-context'

import { ToolErrorBoundary } from './tool-error-boundary'

const statusConfig: Record<
  ArtifactStatus,
  {
    label: string
    icon: typeof Loader2
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    animate?: boolean
  }
> = {
  building: {
    label: 'Building',
    icon: Loader2,
    variant: 'secondary',
    animate: true
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    variant: 'default'
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive'
  },
  restarting: {
    label: 'Restarting',
    icon: RotateCw,
    variant: 'secondary',
    animate: true
  },
  expired: {
    label: 'Expired',
    icon: Timer,
    variant: 'outline'
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
  const Icon = config.icon

  const isAlreadyOpen = state.workspace.artifactId === data.id

  const handleView = () => {
    openWorkspace({
      artifactId: data.id,
      title: data.title,
      status: data.status,
      previewUrl: data.previewUrl,
      revisionId: data.revisionId
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-card-foreground shadow-sm max-w-md">
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-sm font-medium truncate">{data.title}</span>
        <Badge
          variant={config.variant}
          className="w-fit text-[10px] px-1.5 py-0"
        >
          <Icon
            className={`mr-1 size-3 ${config.animate ? 'animate-spin' : ''}`}
          />
          {config.label}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-xs"
        onClick={handleView}
        disabled={isAlreadyOpen}
      >
        {isAlreadyOpen ? 'Viewing' : 'View'}
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
