import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { tryRenderToolUIByName } from './registry'

const canvasArtifactOutput = {
  artifactId: 'art-1',
  chatId: 'chat-1',
  title: 'Canvas Artifact',
  status: 'ready' as const,
  draftRevision: 2,
  currentVersionId: null
}

describe('tool UI registry', () => {
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
