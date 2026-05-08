import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ScoreCell } from '../score-cell'

function renderScoreCell(node: React.ReactNode) {
  return render(<TooltipProvider delayDuration={0}>{node}</TooltipProvider>)
}

describe('ScoreCell', () => {
  it('shows score context and failure-mode guidance for known judge rows', async () => {
    renderScoreCell(
      <ScoreCell
        suite="trafficMonitor"
        judgeKey="faithfulness"
        value={0.9}
        caseCount={10}
        threshold={0.8}
        failed={false}
      >
        <span>Faithfulness row</span>
      </ScoreCell>
    )

    const trigger = screen.getByText('Faithfulness row').parentElement!
    expect(trigger).toHaveClass('block', 'w-full', 'cursor-help')
    expect(trigger).toHaveClass('focus-visible:ring-2')
    expect(trigger).toHaveAttribute('tabindex', '0')
    expect(trigger).toHaveAttribute('role', 'meter')
    expect(trigger).toHaveAttribute('aria-valuemin', '0')
    expect(trigger).toHaveAttribute('aria-valuemax', '100')
    expect(trigger).toHaveAttribute('aria-valuenow', '90')
    expect(trigger).toHaveAttribute(
      'aria-valuetext',
      'Faithfulness score 90%, on track, 80% threshold, 10 cases'
    )

    fireEvent.focus(trigger)

    await waitFor(() => {
      expect(screen.getAllByText('Faithfulness · 90%').length).toBeGreaterThan(
        0
      )
    })
    expect(screen.getAllByText('10 cases').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/mean of this judge/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/run threshold is 80%/i).length).toBeGreaterThan(
      0
    )
    expect(
      screen.getAllByText(/threshold status: on track/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('What lowers this score').length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/added details not present in the supplied sources/i)
        .length
    ).toBeGreaterThan(0)
  })

  it('keeps unknown judge rows plain', () => {
    renderScoreCell(
      <ScoreCell suite="benchmarks" judgeKey="unknown_judge" value={0.8}>
        <span>Unknown row</span>
      </ScoreCell>
    )

    expect(screen.getByText('Unknown row').parentElement).not.toHaveClass(
      'cursor-help'
    )
  })
})
