'use client'

import type { ReactNode } from 'react'

import { tryRenderResult as tryRenderDisplayAgentArtifactResult } from '@/lib/tools/display-agent-artifact/result'
import { tryRenderResult as tryRenderDisplayCalloutResult } from '@/lib/tools/display-callout/result'
import { tryRenderResult as tryRenderDisplayChartResult } from '@/lib/tools/display-chart/result'
import { tryRenderResult as tryRenderDisplayCitationsResult } from '@/lib/tools/display-citations/result'
import { tryRenderResult as tryRenderDisplayLinkPreviewResult } from '@/lib/tools/display-link-preview/result'
import { tryRenderResult as tryRenderDisplayPlanResult } from '@/lib/tools/display-plan/result'
import { tryRenderResult as tryRenderDisplayTableResult } from '@/lib/tools/display-table/result'
import { tryRenderResult as tryRenderDisplayTimelineResult } from '@/lib/tools/display-timeline/result'
import type { ToolUiToolName } from '@/lib/tools/tool-ui/metadata'

import { ToolCardMount } from '@/components/motion/tool-card-mount'

import { GeoMap } from './geo-map/geo-map'
import { safeParseSerializableGeoMap } from './geo-map/schema'
import { OptionList } from './option-list/option-list'
import { safeParseSerializableOptionList } from './option-list/schema'
import { QuestionWizard } from './question-wizard/question-wizard'
import { safeParseSerializableQuestionWizard } from './question-wizard/schema'
import { ToolErrorBoundary } from './tool-error-boundary'

export type ToolUiRendererEntry = {
  name: ToolUiToolName
  tryRender: (output: unknown, partId: string) => ReactNode | null
}

export const toolUiRendererEntries = [
  {
    name: 'displayPlan',
    tryRender: tryRenderDisplayPlanResult
  },
  {
    name: 'displayTable',
    tryRender: tryRenderDisplayTableResult
  },
  {
    name: 'displayChart',
    tryRender: tryRenderDisplayChartResult
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
    name: 'displayAgentArtifact',
    tryRender: tryRenderDisplayAgentArtifactResult
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
    tryRender: tryRenderDisplayCalloutResult
  },
  {
    name: 'displayTimeline',
    tryRender: tryRenderDisplayTimelineResult
  }
] as const satisfies readonly ToolUiRendererEntry[]

const toolUiRendererByName = new Map(
  toolUiRendererEntries.map(entry => [entry.name, entry])
)

export function tryRenderRegisteredToolUiResult(
  toolName: string,
  output: unknown,
  partId: string
): ReactNode | null {
  return (
    toolUiRendererByName
      .get(toolName as ToolUiToolName)
      ?.tryRender(output, partId) ?? null
  )
}

export function tryRenderAnyRegisteredToolUiResult(
  output: unknown,
  partId: string
): ReactNode | null {
  for (const entry of toolUiRendererEntries) {
    const rendered = entry.tryRender(output, partId)
    if (rendered) return rendered
  }

  return null
}

export function isRegisteredToolUiRenderer(toolName: string): boolean {
  return toolUiRendererByName.has(toolName as ToolUiToolName)
}
