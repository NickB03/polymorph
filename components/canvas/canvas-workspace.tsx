'use client'

import { useState } from 'react'

import {
  AlertCircle,
  Code2,
  Download,
  Eye,
  History,
  Save,
  Sparkles,
  X
} from 'lucide-react'

import type { CanvasArtifactStatus } from '@/lib/types/canvas'
import { cn } from '@/lib/utils'

import { useIsMobile } from '@/hooks/use-mobile'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import { useCanvas } from './canvas-context'
import { CanvasDiagnosticsPanel } from './canvas-diagnostics-panel'
import { CanvasEditor } from './canvas-editor'
import { CanvasLegacyNotice } from './canvas-legacy-notice'
import { CanvasPreview } from './canvas-preview'
import { CanvasVersionHistory } from './canvas-version-history'

// ── Status helpers ───────────────────────────────────────────────────

const STATUS_LABELS: Record<CanvasArtifactStatus, string> = {
  generating: 'Generating',
  compiling: 'Compiling',
  ready: 'Ready',
  compile_failed: 'Error',
  restoring: 'Restoring'
}

const STATUS_VARIANTS: Record<
  CanvasArtifactStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  generating: 'secondary',
  compiling: 'secondary',
  ready: 'default',
  compile_failed: 'destructive',
  restoring: 'secondary'
}

function isReadOnly(status: CanvasArtifactStatus): boolean {
  return status === 'generating' || status === 'restoring'
}

// ── Tab types ────────────────────────────────────────────────────────

type MobileTab = 'preview' | 'code' | 'diagnostics' | 'history'
type RightPanelTab = 'code' | 'diagnostics' | 'history'

// ── Component ────────────────────────────────────────────────────────

export function CanvasWorkspace() {
  const canvas = useCanvas()
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview')
  const [rightTab, setRightTab] = useState<RightPanelTab>('code')

  // Loading state
  if (canvas.isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center"
        data-testid="canvas-loading"
      >
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  // Legacy notice state
  if (canvas.legacyNotice) {
    return <CanvasLegacyNotice notice={canvas.legacyNotice} />
  }

  // No artifact loaded — should not render, but handle gracefully
  if (!canvas.artifact) {
    return null
  }

  const { artifact } = canvas
  const readOnly = isReadOnly(artifact.status)

  // ── Header ─────────────────────────────────────────────────────

  const header = (
    <div className="flex items-center justify-between border-b px-3 py-2 min-h-[49px]">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-medium truncate">{artifact.title}</h2>
        <Badge
          variant={STATUS_VARIANTS[artifact.status]}
          data-testid="canvas-status-badge"
        >
          {STATUS_LABELS[artifact.status]}
        </Badge>
        {readOnly && (
          <span
            className="text-xs text-muted-foreground"
            data-testid="canvas-readonly-indicator"
          >
            Read-only
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => canvas.saveVersion()}
          disabled={artifact.status !== 'ready'}
          data-testid="canvas-save-version"
          aria-label="Save version"
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => canvas.exportHtml()}
          disabled={!artifact.draftCompiledHtml}
          data-testid="canvas-export"
          aria-label="Export HTML"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="AI-assisted editing coming soon"
          data-testid="canvas-ask-ai"
          aria-label="Ask AI to change it (coming soon)"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => canvas.closeWorkspace()}
          data-testid="canvas-close"
          aria-label="Close workspace"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  // ── Right panel tab bar (desktop) ─────────────────────────────

  const rightPanelTabBar = (
    <div className="flex border-b" data-testid="canvas-right-tabs">
      {(
        [
          { id: 'code', icon: Code2, label: 'Code' },
          { id: 'diagnostics', icon: AlertCircle, label: 'Diagnostics' },
          { id: 'history', icon: History, label: 'History' }
        ] as const
      ).map(tab => (
        <button
          key={tab.id}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
            rightTab === tab.id
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setRightTab(tab.id)}
          data-testid={`canvas-right-tab-${tab.id}`}
        >
          <tab.icon className="inline h-4 w-4 mr-1" />
          {tab.label}
        </button>
      ))}
    </div>
  )

  // ── Right panel content ───────────────────────────────────────

  function renderRightContent(tab: RightPanelTab) {
    switch (tab) {
      case 'code':
        return (
          <div className="h-full" data-testid="canvas-code-slot">
            <CanvasEditor />
          </div>
        )
      case 'diagnostics':
        return (
          <div className="h-full" data-testid="canvas-diagnostics-slot">
            <CanvasDiagnosticsPanel />
          </div>
        )
      case 'history':
        return (
          <div className="h-full" data-testid="canvas-history-slot">
            <CanvasVersionHistory />
          </div>
        )
    }
  }

  // ── Mobile: tabbed view ────────────────────────────────────────

  if (isMobile) {
    const mobileTabs = [
      { id: 'preview' as MobileTab, icon: Eye, label: 'Preview' },
      { id: 'code' as MobileTab, icon: Code2, label: 'Code' },
      {
        id: 'diagnostics' as MobileTab,
        icon: AlertCircle,
        label: 'Diagnostics'
      },
      { id: 'history' as MobileTab, icon: History, label: 'History' }
    ]

    return (
      <div className="flex h-full flex-col" data-testid="canvas-workspace">
        {header}
        <div className="flex border-b">
          {mobileTabs.map(tab => (
            <button
              key={tab.id}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                mobileTab === tab.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setMobileTab(tab.id)}
              data-testid={`canvas-tab-${tab.id}`}
            >
              <tab.icon className="inline h-4 w-4 mr-1" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {mobileTab === 'preview' && (
            <div className="h-full" data-testid="canvas-preview-slot">
              <CanvasPreview />
            </div>
          )}
          {mobileTab === 'code' && (
            <div className="h-full" data-testid="canvas-code-slot">
              <CanvasEditor />
            </div>
          )}
          {mobileTab === 'diagnostics' && (
            <div className="h-full" data-testid="canvas-diagnostics-slot">
              <CanvasDiagnosticsPanel />
            </div>
          )}
          {mobileTab === 'history' && (
            <div className="h-full" data-testid="canvas-history-slot">
              <CanvasVersionHistory />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Desktop: split-pane ────────────────────────────────────────

  return (
    <div className="flex h-full flex-col" data-testid="canvas-workspace">
      {header}
      <div className="flex flex-1 min-h-0" data-testid="canvas-split-pane">
        <div
          className="flex-1 min-w-0 border-r"
          data-testid="canvas-preview-slot"
        >
          <CanvasPreview />
        </div>
        <div className="flex flex-1 min-w-0 flex-col">
          {rightPanelTabBar}
          <div className="flex-1 min-h-0">{renderRightContent(rightTab)}</div>
        </div>
      </div>
    </div>
  )
}
