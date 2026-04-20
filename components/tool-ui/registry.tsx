'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'

import { Callout } from './callout/callout'
import { safeParseSerializableCallout } from './callout/schema'
import { Chart } from './chart/chart'
import { safeParseSerializableChart } from './chart/schema'
import { CitationList } from './citation/citation-list'
import { safeParseSerializableCitation } from './citation/schema'
import { CodeBlock } from './code-block/code-block'
import { safeParseSerializableCodeBlock } from './code-block/schema'
import { CodeDiff } from './code-diff/code-diff'
import { safeParseSerializableCodeDiff } from './code-diff/schema'
import { DataTable } from './data-table/data-table'
import { safeParseSerializableDataTable } from './data-table/schema'
import { GenerateImage } from './generate-image/generate-image'
import { safeParseSerializableGenerateImage } from './generate-image/schema'
import { LinkPreview } from './link-preview/link-preview'
import { safeParseSerializableLinkPreview } from './link-preview/schema'
import { OptionList } from './option-list/option-list'
import { safeParseSerializableOptionList } from './option-list/schema'
import { Plan } from './plan/plan'
import { safeParseSerializablePlan } from './plan/schema'
import { QuestionWizard } from './question-wizard/question-wizard'
import { safeParseSerializableQuestionWizard } from './question-wizard/schema'
import { safeParseSerializableTimeline } from './timeline/schema'
import { Timeline } from './timeline/timeline'
import {
  CanvasArtifactCard,
  tryParseCanvasArtifactCardData
} from './canvas-artifact-card'
import { ToolErrorBoundary } from './tool-error-boundary'

type ToolUIEntry = {
  name: string
  tryRender: (output: unknown, partId: string) => ReactNode | null
}

function renderCanvasArtifactInMount(
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
    name: 'displayCodeBlock',
    tryRender: output => {
      const parsed = safeParseSerializableCodeBlock(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="CodeBlock">
          <CodeBlock {...parsed} />
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayCodeDiff',
    tryRender: output => {
      const parsed = safeParseSerializableCodeDiff(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="CodeDiff">
          <CodeDiff {...parsed} />
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayCitations',
    tryRender: (output, partId) => {
      // Output can be an array of citations or an object with a citations array
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
  },
  {
    name: 'displayLinkPreview',
    tryRender: (output, partId) => {
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
    tryRender: (output, partId) => {
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
  },
  {
    name: 'canvasArtifactCard',
    tryRender: renderCanvasArtifactInMount
  },
  {
    name: 'createCanvasArtifact',
    tryRender: renderCanvasArtifactInMount
  },
  {
    name: 'updateCanvasArtifact',
    tryRender: renderCanvasArtifactInMount
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
