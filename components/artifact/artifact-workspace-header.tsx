'use client'

import { useCallback } from 'react'

import {
  Check,
  Code2,
  Copy,
  Eye,
  FileCode,
  Minimize2,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Sparkles
} from 'lucide-react'

import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard'
import type { ArtifactStatus } from '@/lib/types/artifact'

import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

import {
  formatArtifactFixPrompt,
  useArtifact,
  useArtifactAction,
  type WorkspaceTab
} from './artifact-context'

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
  const { state, closeWorkspace, requestAiFix, workspaceLogs } = useArtifact()
  const { workspace } = state
  const { execute: handleRefresh, isPending: isRefreshing } =
    useArtifactAction('refresh')
  const { execute: handleRetry, isPending: isRetrying } =
    useArtifactAction('retry')
  const { execute: handleRebuild, isPending: isRebuilding } =
    useArtifactAction('rebuild')
  const { isCopied: copied, copyToClipboard } = useCopyToClipboard({
    timeout: 2000
  })

  const handleAskAiFix = useCallback(() => {
    if (!requestAiFix) return
    requestAiFix(formatArtifactFixPrompt(workspaceLogs))
  }, [requestAiFix, workspaceLogs])

  const handleShare = useCallback(() => {
    if (workspace.previewUrl) copyToClipboard(workspace.previewUrl)
  }, [workspace.previewUrl, copyToClipboard])

  const isFailed = workspace.status === 'failed'
  const isExpired = workspace.status === 'expired'
  const canRebuild = workspace.canRebuild

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
          <div role="tablist" className="flex items-center gap-0.5">
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              role="tab"
              onClick={() => onTabChange('preview')}
              aria-label="Preview"
              aria-selected={activeTab === 'preview'}
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
              role="tab"
              onClick={() => onTabChange('code')}
              aria-label="Code"
              aria-selected={activeTab === 'code'}
              tooltipContent="Code"
            >
              <FileCode
                className={`h-3.5 w-3.5 ${activeTab === 'code' ? 'text-foreground' : 'text-muted-foreground'}`}
              />
            </TooltipButton>
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              role="tab"
              onClick={() => onTabChange('logs')}
              aria-label="Logs"
              aria-selected={activeTab === 'logs'}
              tooltipContent="Logs"
            >
              <ScrollText
                className={`h-3.5 w-3.5 ${activeTab === 'logs' ? 'text-foreground' : 'text-muted-foreground'}`}
              />
            </TooltipButton>
          </div>

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
            <>
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
              {requestAiFix && (
                <TooltipButton
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleAskAiFix}
                  aria-label="Ask AI to fix"
                  tooltipContent="Ask AI to fix"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </TooltipButton>
              )}
            </>
          )}

          {isExpired && canRebuild && (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRebuild}
              disabled={isRebuilding}
              aria-label="Rebuild preview"
              tooltipContent="Rebuild preview"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 ${isRebuilding ? 'animate-spin' : ''}`}
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
