import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FeatureShowcase } from '../feature-showcase'

describe('FeatureShowcase', () => {
  it('renders all four category titles', () => {
    render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /chat & search/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^research/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^build/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /generative ui/i })
    ).toBeInTheDocument()
  })

  it('starts on Chat & Search and advances with Next', () => {
    render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    const chatButton = screen.getByRole('button', { name: /chat & search/i })
    expect(chatButton.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const researchButton = screen.getByRole('button', { name: /^research/i })
    expect(researchButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking a category card jumps directly to that preview', () => {
    render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /generative ui/i }))
    const target = screen.getByRole('button', { name: /generative ui/i })
    expect(target.getAttribute('aria-pressed')).toBe('true')
  })

  it('resets activeIndex to 0 when the dialog reopens', () => {
    const { rerender } = render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /generative ui/i }))
    expect(
      screen
        .getByRole('button', { name: /generative ui/i })
        .getAttribute('aria-pressed')
    ).toBe('true')

    rerender(<FeatureShowcase open={false} onOpenChange={vi.fn()} />)
    rerender(<FeatureShowcase open onOpenChange={vi.fn()} />)
    expect(
      screen
        .getByRole('button', { name: /chat & search/i })
        .getAttribute('aria-pressed')
    ).toBe('true')
  })
})
