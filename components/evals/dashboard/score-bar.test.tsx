import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getScoreStatus, ScoreBar } from './score-bar'

describe('ScoreBar', () => {
  it('renders on-track scores with clamped fill width and threshold marker', () => {
    render(<ScoreBar threshold={0.8} value={0.9} />)

    expect(screen.getByTestId('score-bar')).toHaveAttribute(
      'data-score-status',
      'on-track'
    )
    expect(screen.getByTestId('score-bar-fill')).toHaveClass('bg-success')
    expect(screen.getByTestId('score-bar-fill')).toHaveStyle({ width: '90%' })
    expect(screen.getByTestId('score-bar-threshold')).toHaveStyle({
      left: '80%'
    })
  })

  it('uses the run threshold before fallback cutoffs', () => {
    expect(getScoreStatus({ value: 0.82, threshold: 0.7 })).toBe('on-track')
    expect(getScoreStatus({ value: 0.82, threshold: 0.8 })).toBe(
      'near-threshold'
    )
  })

  it('renders below-threshold and near-threshold status colors', () => {
    const { rerender } = render(<ScoreBar threshold={0.8} value={0.78} />)

    expect(screen.getByTestId('score-bar')).toHaveAttribute(
      'data-score-status',
      'below-threshold'
    )
    expect(screen.getByTestId('score-bar-fill')).toHaveClass('bg-destructive')

    rerender(<ScoreBar threshold={0.8} value={0.82} />)
    expect(screen.getByTestId('score-bar')).toHaveAttribute(
      'data-score-status',
      'near-threshold'
    )
    expect(screen.getByTestId('score-bar-fill')).toHaveClass('bg-accent-amber')
  })

  it('treats an explicit failure as below threshold', () => {
    render(<ScoreBar failed threshold={0.8} value={0.92} />)

    expect(screen.getByTestId('score-bar')).toHaveAttribute(
      'data-score-status',
      'below-threshold'
    )
    expect(screen.getByTestId('score-bar-fill')).toHaveClass('bg-destructive')
  })

  it('clamps out-of-range score and threshold values', () => {
    render(<ScoreBar threshold={1.2} value={2} />)

    expect(screen.getByTestId('score-bar-fill')).toHaveStyle({ width: '100%' })
    expect(screen.getByTestId('score-bar-threshold')).toHaveStyle({
      left: '100%'
    })
  })

  it('uses fallback severity when no threshold exists', () => {
    const { rerender } = render(<ScoreBar value={0.86} />)
    expect(screen.getByTestId('score-bar')).toHaveAttribute(
      'data-score-status',
      'on-track'
    )

    rerender(<ScoreBar value={0.8} />)
    expect(screen.getByTestId('score-bar')).toHaveAttribute(
      'data-score-status',
      'near-threshold'
    )

    rerender(<ScoreBar value={0.65} />)
    expect(screen.getByTestId('score-bar')).toHaveAttribute(
      'data-score-status',
      'below-threshold'
    )
  })
})
