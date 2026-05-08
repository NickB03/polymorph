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

  it('renders markdown table artifacts as structured table previews and switches versions', () => {
    render(
      <AgentArtifact
        id="artifact-table"
        title="Q4 Sales Performance"
        artifactType="table"
        language="markdown"
        content={[
          '# Q4 Sales Performance .csv v2',
          '',
          '| Region | Revenue | Deals | Win Rate | Avg Deal | QoQ Growth |',
          '| --- | --- | --- | --- | --- | --- |',
          '| North America | $1.24M | 86 | 74% | $14.4k | +12% |',
          '| Europe | $980K | 72 | 68% | $13.6k | +8% |',
          '| APAC | $640K | 54 | 71% | $11.8k | +18% |',
          '| LATAM | $310K | 31 | 62% | $10.0k | +5% |',
          '| MEA | $185K | 18 | 58% | $10.3k | +22% |'
        ].join('\n')}
        currentVersion="v2"
        versions={[
          {
            id: 'v1',
            label: 'v1',
            timestamp: '10:02 AM',
            content: [
              '| Region | Revenue | Deals | Win Rate | Avg Deal |',
              '| --- | --- | --- | --- | --- |',
              '| North America | $1.24M | 86 | 74% | $14.4k |',
              '| Europe | $980K | 72 | 68% | $13.6k |'
            ].join('\n')
          },
          {
            id: 'v2',
            label: 'v2',
            timestamp: '10:14 AM',
            content: [
              '# Q4 Sales Performance .csv v2',
              '',
              '| Region | Revenue | Deals | Win Rate | Avg Deal | QoQ Growth |',
              '| --- | --- | --- | --- | --- | --- |',
              '| North America | $1.24M | 86 | 74% | $14.4k | +12% |',
              '| Europe | $980K | 72 | 68% | $13.6k | +8% |'
            ].join('\n')
          }
        ]}
      />
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(
      screen.queryByText('| Region | Revenue | Deals | Win Rate | Avg Deal |')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Region' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'QoQ Growth' })
    ).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '+12%' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show v1' }))

    expect(
      screen.queryByRole('columnheader', { name: 'QoQ Growth' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current version v1' }))
  })
})
