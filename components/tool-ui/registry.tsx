'use client'

import type { ReactNode } from 'react'

import { tryRenderResult as tryRenderCreateCanvasArtifactResult } from '@/lib/tools/create-canvas-artifact/result'
import { tryRenderResult as tryRenderDisplayCitationsResult } from '@/lib/tools/display-citations/result'
import { tryRenderResult as tryRenderDisplayLinkPreviewResult } from '@/lib/tools/display-link-preview/result'
import { tryRenderResult as tryRenderGenerateImageResult } from '@/lib/tools/generate-image/result'
import { tryRenderResult as tryRenderUpdateCanvasArtifactResult } from '@/lib/tools/update-canvas-artifact/result'

import { ToolCardMount } from '@/components/motion/tool-card-mount'

import { Callout } from './callout/callout'
import { safeParseSerializableCallout } from './callout/schema'
import { Chart } from './chart/chart'
import { safeParseSerializableChart } from './chart/schema'
import { DataTable } from './data-table/data-table'
import { safeParseSerializableDataTable } from './data-table/schema'
import { GeoMap } from './geo-map/geo-map'
import { safeParseSerializableGeoMap } from './geo-map/schema'
import { OptionList } from './option-list/option-list'
import { safeParseSerializableOptionList } from './option-list/schema'
import { Plan } from './plan/plan'
import { safeParseSerializablePlan } from './plan/schema'
import { QuestionWizard } from './question-wizard/question-wizard'
import { safeParseSerializableQuestionWizard } from './question-wizard/schema'
import { safeParseSerializableTimeline } from './timeline/schema'
import { Timeline } from './timeline/timeline'
import {
  CompetitorResearchResult,
  safeParseCompetitorResearchResult
} from './competitor-research-result'
import { ToolErrorBoundary } from './tool-error-boundary'

type ToolUIEntry = {
  name: string
  tryRender: (output: unknown, partId: string) => ReactNode | null
}

const entries: ToolUIEntry[] = [
  {
    name: 'displayPlan',
    tryRender: (output, partId) => {
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
  },
  {
    name: 'displayTable',
    tryRender: (output, partId) => {
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
  },
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
    name: 'displayChart',
    tryRender: (output, partId) => {
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
  },
  {
    name: 'displayGeoMap',
    tryRender: (output, partId) => {
      const parsed = safeParseSerializableGeoMap(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="GeoMap">
          <ToolCardMount partId={partId}>
            <GeoMap {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayCitations',
    tryRender: tryRenderDisplayCitationsResult
  },
  {
    name: 'displayLinkPreview',
    tryRender: tryRenderDisplayLinkPreviewResult
  },
  {
    name: 'displayOptionList',
    tryRender: (output, partId) => {
      const parsed = safeParseSerializableOptionList(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="OptionList">
          <ToolCardMount partId={partId}>
            <OptionList {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayQuestionWizard',
    tryRender: (output, partId) => {
      const parsed = safeParseSerializableQuestionWizard(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="QuestionWizard">
          <ToolCardMount partId={partId}>
            <QuestionWizard {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayCallout',
    tryRender: (output, partId) => {
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
  },
  {
    name: 'displayTimeline',
    tryRender: (output, partId) => {
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

/**
 * Try to render tool output using a named Tool UI component.
 * Falls back to trying all registered schemas if no name match.
 */
export function tryRenderToolUIByName(
  toolName: string,
  output: unknown,
  partId: string
): ReactNode | null {
  // Try named match first
  const named = entries.find(e => e.name === toolName)
  if (named) {
    const result = named.tryRender(output, partId)
    if (result) return result
  }

  // Fall back to trying all schemas
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
  for (const entry of entries) {
    const result = entry.tryRender(output, partId)
    if (result) return result
  }
  return null
}

/**
 * Check if a tool name has a registered UI component.
 */
export function isRegisteredToolUI(toolName: string): boolean {
  return entries.some(e => e.name === toolName)
}
