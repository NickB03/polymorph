'use client'

import { Component, type ReactNode, useState } from 'react'

import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import { ArtifactCodeViewer } from './artifact-code-viewer'
import { useArtifact, type WorkspaceTab } from './artifact-context'
import { ArtifactErrorPanel } from './artifact-error-panel'
import { ArtifactLogsPanel } from './artifact-logs-panel'
import { ArtifactPreviewFrame } from './artifact-preview-frame'
import { ArtifactWorkspaceHeader } from './artifact-workspace-header'

interface WorkspaceErrorBoundaryProps {
  onClose: () => void
  children: ReactNode
}

interface WorkspaceErrorBoundaryState {
  hasError: boolean
}

class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  constructor(props: WorkspaceErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[ArtifactWorkspace] Render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Something went wrong in the workspace
            </p>
            <p className="text-xs text-muted-foreground">
              An unexpected error occurred while rendering the artifact
              workspace.
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={this.props.onClose}>
              Close
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function ArtifactWorkspace() {
  const { state, closeWorkspace } = useArtifact()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('preview')

  const isFailed = state.workspace.status === 'failed'
  const showErrorPanel = isFailed && activeTab === 'preview'

  if (!state.workspace.isOpen) return null

  return (
    <div className="h-full flex flex-col overflow-hidden bg-muted md:px-4 md:pt-14 md:pb-4">
      <div className="flex flex-col h-full bg-background rounded-xl md:border overflow-hidden">
        <WorkspaceErrorBoundary onClose={closeWorkspace}>
          <ArtifactWorkspaceHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className={cn(activeTab !== 'preview' && 'hidden', 'h-full')}>
              {showErrorPanel ? (
                <ArtifactErrorPanel />
              ) : (
                <ArtifactPreviewFrame />
              )}
            </div>
            <div className={cn(activeTab !== 'code' && 'hidden', 'h-full')}>
              <ArtifactCodeViewer />
            </div>
            <div className={cn(activeTab !== 'logs' && 'hidden', 'h-full')}>
              <ArtifactLogsPanel />
            </div>
          </div>
        </WorkspaceErrorBoundary>
      </div>
    </div>
  )
}
