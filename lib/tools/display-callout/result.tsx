'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { Callout } from '@/components/tool-ui/callout/callout'
import { safeParseSerializableCallout } from '@/components/tool-ui/callout/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Callout

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableCallout(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Callout">
      <ToolCardMount partId={partId}>
        <Callout {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
