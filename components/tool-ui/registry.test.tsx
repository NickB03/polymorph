import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./geo-map/geo-map', () => ({
  GeoMap: (props: { id: string }) => (
    <div data-testid="geo-map" data-id={props.id} />
  )
}))

import { tryRenderToolUIByName } from './registry'

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

  it('falls back to matching schemas for unrelated tool names', () => {
    const node = tryRenderToolUIByName(
      'unknownTool',
      canvasArtifactOutput,
      'test-part-id'
    )

    render(<>{node}</>)

    expect(screen.getByTestId('canvas-artifact-card')).toBeInTheDocument()
  })
})
