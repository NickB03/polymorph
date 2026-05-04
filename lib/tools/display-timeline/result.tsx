'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { safeParseSerializableTimeline } from '@/components/tool-ui/timeline/schema'
import { Timeline } from '@/components/tool-ui/timeline/timeline'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Timeline

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableTimeline(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Timeline">
      <ToolCardMount partId={partId}>
        <Timeline {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
