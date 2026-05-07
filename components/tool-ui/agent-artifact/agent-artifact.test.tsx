import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentArtifact } from '..'

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.assign(navigator, {
    clipboard: { writeText }
  })
})

describe('AgentArtifact', () => {
  it('switches tabs, copies active version content, and shows metadata', async () => {
    render(
      <AgentArtifact
        id="artifact-1"
        title="Component Spec"
        artifactType="document"
        content="old content"
        currentVersion="v2"
        versions={[
          {
            id: 'v1',
            label: 'Version 1',
            timestamp: '2026-05-01',
            content: 'old content'
          },
          {
            id: 'v2',
            label: 'Version 2',
            timestamp: '2026-05-02',
            content: 'current version content'
          }
        ]}
        metadata={{ model: 'test-model', tokens: 120, size: '2 KB' }}
      />
    )

    expect(screen.getByText('Component Spec')).toBeInTheDocument()
    expect(screen.getByText('current version content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /code/i }))
    expect(screen.getByText('current version content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /raw/i }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy artifact content' })
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Copied artifact content' })
      ).toBeInTheDocument()
    })
    expect(writeText).toHaveBeenCalledWith('current version content')
    expect(screen.getByText('test-model')).toBeInTheDocument()
    expect(screen.getByText('120 tokens')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Download artifact content' })
    ).toHaveAttribute('download', 'component-spec.md')
  })

  it('handles denied clipboard writes without surfacing an unhandled rejection', async () => {
    writeText.mockRejectedValueOnce(new Error('write denied'))

    render(
      <AgentArtifact
        id="artifact-2"
        title="Clipboard Test"
        artifactType="document"
        content="blocked content"
      />
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Copy artifact content' })
    )

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('blocked content')
    })
    expect(
      screen.getByRole('button', { name: 'Copy artifact content' })
    ).toBeInTheDocument()
  })
})
