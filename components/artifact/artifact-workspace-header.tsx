'use client'

import { useCallback, useState } from 'react'

import {
  Check,
  Code2,
  Copy,
  Eye,
  Minimize2,
  RefreshCw,
  RotateCcw,
  ScrollText
} from 'lucide-react'

import type { ArtifactStatus } from '@/lib/types/artifact'

import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

import { useArtifact } from './artifact-context'

type WorkspaceTab = 'preview' | 'logs'

interface ArtifactWorkspaceHeaderProps {
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
}

function StatusBadge({ status }: { status: ArtifactStatus | null }) {
  if (!status) return null

  const config: Record<ArtifactStatus, { label: string; className: string }> = {
    building: {
      label: 'Building',
      className: 'bg-yellow-500/10 text-yellow-600'
    },
    ready: {
      label: 'Ready',
      className: 'bg-green-500/10 text-green-600'
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-500/10 text-red-600'
    },
    restarting: {
      label: 'Restarting',
      className: 'bg-yellow-500/10 text-yellow-600'
    },
    expired: {
      label: 'Expired',
      className: 'bg-muted text-muted-foreground'
    }
  }

  const { label, className } = config[status]

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  )
}

export function ArtifactWorkspaceHeader({
  activeTab,
  onTabChange
}: ArtifactWorkspaceHeaderProps) {
  const { state, updateWorkspace, closeWorkspace } = useArtifact()
  const { workspace } = state
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleRefresh = useCallback(async () => {
    if (!workspace.artifactId || isRefreshing) return
    setIsRefreshing(true)
    try {
      const res = await fetch(
        `/api/artifacts/${workspace.artifactId}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refresh' })
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
      setIsRefreshing(false)
    }
  }, [workspace, isRefreshing, updateWorkspace])

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

  const handleShare = useCallback(() => {
    if (!workspace.previewUrl || copied) return
    navigator.clipboard.writeText(workspace.previewUrl).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      err => {
        console.error('Failed to copy preview URL to clipboard:', err)
      }
    )
  }, [workspace.previewUrl, copied])

  const isFailed = workspace.status === 'failed'

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 size={16} className="shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">
            {workspace.title || 'Artifact'}
          </span>
          <StatusBadge status={workspace.status} />
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Tab switcher */}
          <TooltipButton
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onTabChange('preview')}
            aria-label="Preview"
            aria-pressed={activeTab === 'preview'}
            tooltipContent="Preview"
          >
            <Eye
              className={`h-3.5 w-3.5 ${activeTab === 'preview' ? 'text-foreground' : 'text-muted-foreground'}`}
            />
          </TooltipButton>
          <TooltipButton
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onTabChange('logs')}
            aria-label="Logs"
            aria-pressed={activeTab === 'logs'}
            tooltipContent="Logs"
          >
            <ScrollText
              className={`h-3.5 w-3.5 ${activeTab === 'logs' ? 'text-foreground' : 'text-muted-foreground'}`}
            />
          </TooltipButton>

          <Separator orientation="vertical" className="mx-1 h-4" />

          {/* Actions */}
          <TooltipButton
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh"
            tooltipContent="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </TooltipButton>

          {isFailed && (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRetry}
              disabled={isRetrying}
              aria-label="Retry"
              tooltipContent="Retry"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`}
              />
            </TooltipButton>
          )}

          {workspace.previewUrl && (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleShare}
              aria-label="Copy preview URL"
              tooltipContent={copied ? 'Copied!' : 'Copy link'}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </TooltipButton>
          )}

          <TooltipButton
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={closeWorkspace}
            aria-label="Close workspace"
            tooltipContent="Minimize"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </TooltipButton>
        </div>
      </div>
      <Separator className="bg-border/50" />
    </TooltipProvider>
  )
}
