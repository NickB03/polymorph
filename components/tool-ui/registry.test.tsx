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

const codeBlockOutput = {
  id: 'code-block-1',
  code: 'export default function App() {\n  return <main>Hello</main>\n}',
  language: 'tsx',
  filename: 'App.tsx',
  lineNumbers: true,
  highlightLines: [2],
  maxCollapsedLines: 12
}

const codeDiffOutput = {
  id: 'code-diff-1',
  oldCode: 'export const title = "Before"\n',
  newCode: 'export const title = "After"\n',
  language: 'ts',
  filename: 'meta.ts',
  lineNumbers: true,
  diffStyle: 'side-by-side' as const,
  maxCollapsedLines: 10
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

  it('renders displayCodeBlock output through the code block UI', () => {
    const node = tryRenderToolUIByName('displayCodeBlock', codeBlockOutput)

    render(<>{node}</>)

    expect(screen.getByText('App.tsx')).toBeInTheDocument()
    expect(screen.getByText(/export default function App/)).toBeInTheDocument()
  })

  it('renders displayCodeDiff output through the code diff UI', () => {
    const node = tryRenderToolUIByName('displayCodeDiff', codeDiffOutput)

    render(<>{node}</>)

    expect(screen.getByText('meta.ts')).toBeInTheDocument()
    expect(screen.getByText(/Before/)).toBeInTheDocument()
    expect(screen.getByText(/After/)).toBeInTheDocument()
  })
})
