'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { LinkPreview } from '@/components/tool-ui/link-preview/link-preview'
import { safeParseSerializableLinkPreview } from '@/components/tool-ui/link-preview/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = LinkPreview

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableLinkPreview(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="LinkPreview">
      <ToolCardMount partId={partId}>
        <LinkPreview {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
