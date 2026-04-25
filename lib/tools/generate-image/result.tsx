'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { GenerateImage } from '@/components/tool-ui/generate-image/generate-image'
import { safeParseSerializableGenerateImage } from '@/components/tool-ui/generate-image/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = GenerateImage

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableGenerateImage(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="GenerateImage">
      <ToolCardMount partId={partId}>
        <GenerateImage {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
