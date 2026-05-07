'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { AgentArtifact } from '@/components/tool-ui/agent-artifact/agent-artifact'
import { safeParseSerializableAgentArtifact } from '@/components/tool-ui/agent-artifact/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = AgentArtifact

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableAgentArtifact(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="AgentArtifact">
      <ToolCardMount partId={partId}>
        <AgentArtifact {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
