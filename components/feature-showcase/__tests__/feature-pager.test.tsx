import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FeaturePager } from '../feature-pager'

describe('FeaturePager', () => {
  it('renders a dot per total step', () => {
    render(
      <FeaturePager
        activeIndex={0}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getAllByTestId('feature-pager-dot')).toHaveLength(4)
  })

  it('marks the active dot with data-active="true"', () => {
    render(
      <FeaturePager
        activeIndex={2}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    const dots = screen.getAllByTestId('feature-pager-dot')
    expect(dots[2].getAttribute('data-active')).toBe('true')
    expect(dots[0].getAttribute('data-active')).toBe('false')
  })

  it('disables Previous on the first step and Next on the last', () => {
    const { rerender } = render(
      <FeaturePager
        activeIndex={0}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()

    rerender(
      <FeaturePager
        activeIndex={3}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('fires onPrev and onNext when the buttons are clicked', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(
      <FeaturePager activeIndex={1} total={4} onPrev={onPrev} onNext={onNext} />
    )
    fireEvent.click(screen.getByRole('button', { name: /previous/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
