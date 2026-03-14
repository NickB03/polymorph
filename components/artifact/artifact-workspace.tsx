'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'

import { ArtifactCodeViewer } from './artifact-code-viewer'
import { useArtifact } from './artifact-context'
import { ArtifactErrorPanel } from './artifact-error-panel'
import { ArtifactLogsPanel } from './artifact-logs-panel'
import { ArtifactPreviewFrame } from './artifact-preview-frame'
import { ArtifactWorkspaceHeader } from './artifact-workspace-header'

type WorkspaceTab = 'preview' | 'code' | 'logs'

export function ArtifactWorkspace() {
  const { state } = useArtifact()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('preview')

  const isFailed = state.workspace.status === 'failed'
  const showErrorPanel = isFailed && activeTab === 'preview'

  if (!state.workspace.isOpen) return null

  return (
    <div className="h-full flex flex-col overflow-hidden bg-muted md:px-4 md:pt-14 md:pb-4">
      <div className="flex flex-col h-full bg-background rounded-xl md:border overflow-hidden">
        <ArtifactWorkspaceHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className={cn(activeTab !== 'preview' && 'hidden', 'h-full')}>
            {showErrorPanel ? <ArtifactErrorPanel /> : <ArtifactPreviewFrame />}
          </div>
          <div className={cn(activeTab !== 'code' && 'hidden', 'h-full')}>
            <ArtifactCodeViewer />
          </div>
          <div className={cn(activeTab !== 'logs' && 'hidden', 'h-full')}>
            <ArtifactLogsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
