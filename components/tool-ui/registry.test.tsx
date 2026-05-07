import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./geo-map/geo-map', () => ({
  GeoMap: (props: { id: string }) => (
    <div data-testid="geo-map" data-id={props.id} />
  )
}))

import { TOOL_UI_TOOL_METADATA } from '@/lib/tools/tool-ui/metadata'

import { isRegisteredToolUI, tryRenderToolUIByName } from './registry'
import { toolUiRendererEntries } from './renderer-catalog'

const canvasArtifactOutput = {
  artifactId: 'art-1',
  chatId: 'chat-1',
  title: 'Canvas Artifact',
  status: 'ready' as const,
  draftRevision: 2,
  currentVersionId: null
}

const geoMapOutput = {
  id: 'test-map',
  markers: [
    { id: 'a', lat: 34.0522, lng: -118.2437, label: 'LA' },
    { id: 'b', lat: 37.7749, lng: -122.4194, label: 'SF' }
  ],
  viewport: { mode: 'fit' as const, target: 'all' as const }
}

describe('tool UI registry', () => {
  it('keeps renderer catalog names aligned with Tool UI metadata', () => {
    expect(toolUiRendererEntries.map(entry => entry.name)).toEqual(
      TOOL_UI_TOOL_METADATA.map(tool => tool.name)
    )
  })

  it('reports registered Tool UI and additional result renderers', () => {
    expect(isRegisteredToolUI('displayTable')).toBe(true)
    expect(isRegisteredToolUI('displayGeoMap')).toBe(true)
    expect(isRegisteredToolUI('competitorResearch')).toBe(true)
    expect(isRegisteredToolUI('generateImage')).toBe(true)
    expect(isRegisteredToolUI('readCanvasArtifact')).toBe(false)
    expect(isRegisteredToolUI('unknownTool')).toBe(false)
  })

  it('renders displayGeoMap output through the geo map component', () => {
    const node = tryRenderToolUIByName(
      'displayGeoMap',
      geoMapOutput,
      'test-part-id'
    )

    render(<>{node}</>)

    expect(screen.getByTestId('geo-map')).toHaveAttribute('data-id', 'test-map')
  })

  it('returns null for invalid displayGeoMap output', () => {
    const node = tryRenderToolUIByName(
      'displayGeoMap',
      { id: 'missing-markers' },
      'test-part-id'
    )

    expect(node).toBeNull()
  })

  it('renders displayAgentArtifact output through the artifact component', () => {
    const node = tryRenderToolUIByName(
      'displayAgentArtifact',
      {
        id: 'artifact-1',
        title: 'API Schema',
        artifactType: 'code',
        content: 'export const schema = z.object({ name: z.string() })',
        language: 'typescript',
        metadata: {
          model: 'test-model',
          tokens: 42,
          size: '1 KB'
        }
      },
      'artifact-part'
    )

    render(<>{node}</>)

    expect(screen.getByText('API Schema')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()
    expect(screen.getByText(/schema = z.object/)).toBeInTheDocument()
  })

  it('returns null for invalid displayAgentArtifact output', () => {
    const node = tryRenderToolUIByName(
      'displayAgentArtifact',
      { id: 'artifact-1', content: 'missing title' },
      'artifact-part'
    )

    expect(node).toBeNull()
  })

  it('renders createCanvasArtifact output through the canvas artifact card', () => {
    const node = tryRenderToolUIByName(
      'createCanvasArtifact',
      canvasArtifactOutput,
      'test-part-id'
    )

    render(<>{node}</>)

    expect(screen.getByTestId('canvas-artifact-card')).toHaveAttribute(
      'data-artifact-id',
      'art-1'
    )
    expect(screen.getByText('Canvas Artifact')).toBeInTheDocument()
  })

  it('renders updateCanvasArtifact output through the canvas artifact card', () => {
    const node = tryRenderToolUIByName(
      'updateCanvasArtifact',
      canvasArtifactOutput,
      'test-part-id'
    )

    render(<>{node}</>)

    expect(screen.getByTestId('canvas-artifact-card')).toHaveAttribute(
      'data-artifact-id',
      'art-1'
    )
  })

  it('does not render readCanvasArtifact output through the canvas card fallback', () => {
    const node = tryRenderToolUIByName(
      'readCanvasArtifact',
      {
        ...canvasArtifactOutput,
        files: [{ path: 'app/page.tsx', content: 'source' }]
      },
      'test-part-id'
    )

    expect(node).toBeNull()
  })

  it('falls back to matching schemas for unrelated tool names', () => {
    const node = tryRenderToolUIByName(
      'unknownTool',
      canvasArtifactOutput,
      'test-part-id'
    )

    render(<>{node}</>)

    expect(screen.getByTestId('canvas-artifact-card')).toBeInTheDocument()
  })

  it('renders competitorResearch output through the competitor research result', () => {
    const node = tryRenderToolUIByName(
      'competitorResearch',
      {
        summary: 'Alpha leads on UX while Beta is stronger on reliability.',
        cards: [
          {
            competitor: 'Alpha',
            strengths: ['Fast onboarding'],
            weaknesses: ['Limited controls']
          }
        ],
        matrix: [
          {
            competitor: 'Alpha',
            UX: 'Strong',
            Reliability: 'Moderate'
          }
        ]
      },
      'test-part-id'
    )

    render(<>{node}</>)

    expect(screen.getByText('Fast onboarding')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'UX' })).toBeInTheDocument()
  })
})
