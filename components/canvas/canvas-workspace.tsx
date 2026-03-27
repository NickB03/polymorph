'use client'

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  Activity,
  AlertCircle,
  Code2,
  Download,
  ExternalLink,
  Eye,
  History,
  MoreHorizontal,
  X
} from 'lucide-react'

import type { CanvasArtifactStatus } from '@/lib/types/canvas'
import { cn } from '@/lib/utils'

import { useIsMobile } from '@/hooks/use-mobile'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

import { useActivity } from '@/components/activity/activity-context'
import { ActivityFeedContent } from '@/components/activity/activity-panel'

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

type ActiveTab = 'preview' | 'code' | 'activity'
type CodeSubTab = 'code' | 'diagnostics' | 'history'
type MobileTab = 'preview' | 'code' | 'diagnostics' | 'history' | 'activity'
type CodeSubTabDefinition = {
  id: CodeSubTab
  icon: typeof Code2
  label: string
}

// ── Error boundary ───────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode
  onClose: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class WorkspaceErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CanvasWorkspace] Render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
          data-testid="canvas-error-boundary"
        >
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div>
            <h3 className="text-sm font-medium">
              Something went wrong rendering the workspace
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {this.state.error?.message}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
              data-testid="canvas-error-retry"
            >
              Retry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.props.onClose}
              data-testid="canvas-error-close"
            >
              Close
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const codeSubTabs: CodeSubTabDefinition[] = [
  { id: 'code', icon: Code2, label: 'Code' },
  { id: 'diagnostics', icon: AlertCircle, label: 'Diagnostics' },
  { id: 'history', icon: History, label: 'History' }
]

function CodeSubTabContent({ tab }: { tab: CodeSubTab }) {
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

// ── Component ────────────────────────────────────────────────────────

export function CanvasWorkspace() {
  const canvas = useCanvas()
  const { state: activityState } = useActivity()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview')
  const [codeSubTab, setCodeSubTab] = useState<CodeSubTab>('code')
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview')
  const [hasUnseenActivity, setHasUnseenActivity] = useState(false)
  const previousItemCountRef = useRef(activityState.items.length)
  const hasActivity = activityState.items.length > 0

  useEffect(() => {
    const previousItemCount = previousItemCountRef.current

    if (activityState.items.length > previousItemCount) {
      const isViewingActivity =
        (isMobile && mobileTab === 'activity') ||
        (!isMobile && activeTab === 'activity')

      if (!isViewingActivity) {
        setHasUnseenActivity(true)
      }
    }

    previousItemCountRef.current = activityState.items.length
  }, [activityState.items.length, activeTab, isMobile, mobileTab])

  useEffect(() => {
    if (!hasActivity) {
      previousItemCountRef.current = 0
      setHasUnseenActivity(false)

      if (activeTab === 'activity') {
        setActiveTab('preview')
      }

      if (mobileTab === 'activity') {
        setMobileTab('preview')
      }
    }
  }, [activeTab, hasActivity, mobileTab])

  useEffect(() => {
    if (activeTab === 'activity' || mobileTab === 'activity') {
      setHasUnseenActivity(false)
    }
  }, [activeTab, mobileTab])

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

  const artifact = canvas.artifact
  const readOnly = isReadOnly(artifact.status)

  // ── Pill tab switcher ──────────────────────────────────────────

  const pillSwitcher = (
    <div
      className="flex rounded-full bg-muted p-0.5"
      data-testid="canvas-pill-switcher"
    >
      <button
        className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center transition-colors',
          activeTab === 'preview'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => setActiveTab('preview')}
        aria-label="Preview"
        data-testid="canvas-pill-preview"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button
        className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center transition-colors',
          activeTab === 'code'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => setActiveTab('code')}
        aria-label="Code"
        data-testid="canvas-pill-code"
      >
        <Code2 className="h-3.5 w-3.5" />
      </button>
      {hasActivity && (
        <button
          className={cn(
            'relative h-6 w-6 rounded-full flex items-center justify-center transition-colors',
            activeTab === 'activity'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('activity')}
          aria-label="Activity"
          data-testid="canvas-pill-activity"
        >
          <Activity className="h-3.5 w-3.5" />
          {hasUnseenActivity && activeTab !== 'activity' && (
            <span
              className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary"
              data-testid="canvas-pill-activity-unseen"
            />
          )}
        </button>
      )}
    </div>
  )

  // ── Header ─────────────────────────────────────────────────────

  const header = (
    <div className="flex items-center justify-between pl-4 pr-2 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {!isMobile && pillSwitcher}
        <h2 className="text-sm font-medium truncate">{artifact.title}</h2>
        {artifact.status !== 'ready' && (
          <Badge
            variant={STATUS_VARIANTS[artifact.status]}
            data-testid="canvas-status-badge"
          >
            {STATUS_LABELS[artifact.status]}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        <TooltipButton
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => canvas.viewFullscreen()}
          disabled={!artifact.draftCompiledHtml}
          aria-label="Open in new tab"
          tooltipContent="Open in new tab"
          data-testid="canvas-view-fullscreen"
        >
          <ExternalLink className="h-4 w-4" />
        </TooltipButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="More actions"
              tooltipContent="More actions"
              data-testid="canvas-more-actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </TooltipButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => canvas.exportHtml()}
              disabled={!artifact.draftCompiledHtml}
              data-testid="canvas-export"
            >
              <Download className="h-4 w-4" />
              Export HTML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipButton
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => canvas.closeWorkspace()}
          data-testid="canvas-close"
          aria-label="Close"
          tooltipContent="Close"
        >
          <X className="h-4 w-4" />
        </TooltipButton>
      </div>
    </div>
  )

  // ── Code sub-tab bar ──────────────────────────────────────────

  const codeSubTabBar = (
    <div className="flex border-b" data-testid="canvas-code-sub-tabs">
      {codeSubTabs.map(tab => (
        <button
          key={tab.id}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
            codeSubTab === tab.id
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setCodeSubTab(tab.id)}
          data-testid={`canvas-code-sub-tab-${tab.id}`}
        >
          <tab.icon className="inline h-4 w-4 mr-1" />
          {tab.label}
        </button>
      ))}
    </div>
  )

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

    if (hasActivity) {
      mobileTabs.push({
        id: 'activity',
        icon: Activity,
        label: 'Activity'
      })
    }

    return (
      <TooltipProvider>
        <WorkspaceErrorBoundary onClose={() => canvas.closeWorkspace()}>
          <div className="flex h-full flex-col" data-testid="canvas-workspace">
            {header}
            <div className="flex border-b">
              {mobileTabs.map(tab => (
                <button
                  key={tab.id}
                  className={cn(
                    'relative flex-1 px-2 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1',
                    mobileTab === tab.id
                      ? 'border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setMobileTab(tab.id)}
                  aria-label={tab.label}
                  data-testid={`canvas-tab-${tab.id}`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-xs truncate">
                    {tab.label}
                  </span>
                  {tab.id === 'activity' &&
                    hasUnseenActivity &&
                    mobileTab !== 'activity' && (
                      <span
                        className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary"
                        data-testid="canvas-tab-activity-unseen"
                      />
                    )}
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
              {mobileTab === 'activity' && (
                <div className="h-full" data-testid="canvas-activity-slot">
                  <ActivityFeedContent items={activityState.items} />
                </div>
              )}
            </div>
          </div>
        </WorkspaceErrorBoundary>
      </TooltipProvider>
    )
  }

  // ── Desktop: card-in-muted with tab-based layout ────────────────

  return (
    <TooltipProvider>
      <WorkspaceErrorBoundary onClose={() => canvas.closeWorkspace()}>
        <div
          className="h-full flex flex-col overflow-hidden bg-muted md:px-4 md:pt-14 md:pb-4"
          data-testid="canvas-workspace"
        >
          <div className="flex flex-col h-full bg-background rounded-xl md:border overflow-hidden">
            {header}
            <Separator className="bg-border/50" />
            <div className="flex-1 min-h-0">
              {activeTab === 'preview' && (
                <div className="h-full" data-testid="canvas-preview-slot">
                  <CanvasPreview />
                </div>
              )}
              {activeTab === 'code' && (
                <div className="flex flex-col h-full">
                  {codeSubTabBar}
                  <div className="flex-1 min-h-0">
                    <CodeSubTabContent tab={codeSubTab} />
                  </div>
                </div>
              )}
              {activeTab === 'activity' && (
                <div className="h-full" data-testid="canvas-activity-slot">
                  <ActivityFeedContent items={activityState.items} />
                </div>
              )}
            </div>
          </div>
        </div>
      </WorkspaceErrorBoundary>
    </TooltipProvider>
  )
}
