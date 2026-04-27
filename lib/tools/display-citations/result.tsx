'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { CitationList } from '@/components/tool-ui/citation/citation-list'
import { safeParseSerializableCitation } from '@/components/tool-ui/citation/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = CitationList

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const items = Array.isArray(output)
    ? output
    : typeof output === 'object' && output !== null && 'citations' in output
      ? (output as { citations: unknown[] }).citations
      : null
  if (!items || !Array.isArray(items)) return null

  const parsed = items
    .map(item => safeParseSerializableCitation(item))
    .filter(Boolean)
  if (parsed.length === 0) return null

  return (
    <ToolErrorBoundary toolName="CitationList">
      <ToolCardMount partId={partId}>
        <CitationList
          id={`citations-${parsed[0]!.id}`}
          citations={parsed as NonNullable<(typeof parsed)[number]>[]}
          variant="default"
        />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
