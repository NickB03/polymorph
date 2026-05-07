'use client'

import type { ReactNode } from 'react'

import { tryRenderResult as tryRenderCreateCanvasArtifactResult } from '@/lib/tools/create-canvas-artifact/result'
import { tryRenderResult as tryRenderGenerateImageResult } from '@/lib/tools/generate-image/result'
import { tryRenderResult as tryRenderUpdateCanvasArtifactResult } from '@/lib/tools/update-canvas-artifact/result'

import { ToolCardMount } from '@/components/motion/tool-card-mount'

import {
  CompetitorResearchResult,
  safeParseCompetitorResearchResult
} from './competitor-research-result'
import {
  isRegisteredToolUiRenderer,
  tryRenderAnyRegisteredToolUiResult,
  tryRenderRegisteredToolUiResult
} from './renderer-catalog'
import { ToolErrorBoundary } from './tool-error-boundary'

type ResultRendererEntry = {
  name: string
  tryRender: (output: unknown, partId: string) => ReactNode | null
}

const additionalResultRendererEntries: ResultRendererEntry[] = [
  {
    name: 'competitorResearch',
    tryRender: (output, partId) => {
      const parsed = safeParseCompetitorResearchResult(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="CompetitorResearch">
          <ToolCardMount partId={partId}>
            <CompetitorResearchResult {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'generateImage',
    tryRender: tryRenderGenerateImageResult
  },
  {
    name: 'canvasArtifactCard',
    tryRender: tryRenderCreateCanvasArtifactResult
  },
  {
    name: 'createCanvasArtifact',
    tryRender: tryRenderCreateCanvasArtifactResult
  },
  {
    name: 'updateCanvasArtifact',
    tryRender: tryRenderUpdateCanvasArtifactResult
  }
]

const additionalResultRendererByName = new Map(
  additionalResultRendererEntries.map(entry => [entry.name, entry])
)

const nonRenderableToolNames = new Set(['readCanvasArtifact'])

function isRegisteredAdditionalResultRenderer(toolName: string): boolean {
  return additionalResultRendererByName.has(toolName)
}

function tryRenderAdditionalResultByName(
  toolName: string,
  output: unknown,
  partId: string
): ReactNode | null {
  return (
    additionalResultRendererByName.get(toolName)?.tryRender(output, partId) ??
    null
  )
}

function tryRenderAnyAdditionalResult(
  output: unknown,
  partId: string
): ReactNode | null {
  for (const entry of additionalResultRendererEntries) {
    const rendered = entry.tryRender(output, partId)
    if (rendered) return rendered
  }

  return null
}

/**
 * Try to render tool output using a named Tool UI component.
 * Falls back to matching all registered schemas if no name match renders.
 */
export function tryRenderToolUIByName(
  toolName: string,
  output: unknown,
  partId: string
): ReactNode | null {
  const namedToolUi = tryRenderRegisteredToolUiResult(toolName, output, partId)
  if (namedToolUi) return namedToolUi

  const namedAdditional = tryRenderAdditionalResultByName(
    toolName,
    output,
    partId
  )
  if (namedAdditional) return namedAdditional

  if (nonRenderableToolNames.has(toolName)) {
    return null
  }

  return tryRenderToolUI(output, partId)
}

/**
 * Try to render tool output by testing against all registered schemas.
 * Returns the first successful match or null.
 */
export function tryRenderToolUI(
  output: unknown,
  partId: string
): ReactNode | null {
  return (
    tryRenderAnyRegisteredToolUiResult(output, partId) ??
    tryRenderAnyAdditionalResult(output, partId)
  )
}

/**
 * Check if a tool name has a rich renderer. Includes manifest Tool UI
 * renderers plus additional result renderers that still use this facade.
 */
export function isRegisteredToolUI(toolName: string): boolean {
  return (
    isRegisteredToolUiRenderer(toolName) ||
    isRegisteredAdditionalResultRenderer(toolName)
  )
}
