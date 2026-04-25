'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import {
  CanvasArtifactCard,
  tryParseCanvasArtifactCardData
} from '@/components/tool-ui/canvas-artifact-card'

export const ResultComponent = CanvasArtifactCard

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const data = tryParseCanvasArtifactCardData(output)
  if (!data) return null
  return (
    <ToolCardMount partId={partId}>
      <CanvasArtifactCard data={data} />
    </ToolCardMount>
  )
}
