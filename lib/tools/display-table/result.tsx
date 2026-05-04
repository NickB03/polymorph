'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { DataTable } from '@/components/tool-ui/data-table/data-table'
import { safeParseSerializableDataTable } from '@/components/tool-ui/data-table/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = DataTable

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableDataTable(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="DataTable">
      <ToolCardMount partId={partId}>
        <DataTable {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
