'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { Plan } from '@/components/tool-ui/plan/plan'
import { safeParseSerializablePlan } from '@/components/tool-ui/plan/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Plan

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializablePlan(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Plan">
      <ToolCardMount partId={partId}>
        <Plan {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
