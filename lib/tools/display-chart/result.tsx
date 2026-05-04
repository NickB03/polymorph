'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { Chart } from '@/components/tool-ui/chart/chart'
import { safeParseSerializableChart } from '@/components/tool-ui/chart/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Chart

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableChart(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Chart">
      <ToolCardMount partId={partId}>
        <Chart {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
