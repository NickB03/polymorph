import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ScoopCard } from './scoop-card'

describe('ScoopCard', () => {
  it('renders icon and body content', () => {
    render(
      <ScoopCard tint="ready" icon={<span data-testid="icon">i</span>}>
        <span>body content</span>
      </ScoopCard>
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('applies the success fill for ready status', () => {
    render(
      <ScoopCard tint="ready" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-success/20')
  })

  it('applies the warning fill for watch status', () => {
    render(
      <ScoopCard tint="watch" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-warning/25')
  })

  it('applies destructive fill for blocked status', () => {
    render(
      <ScoopCard tint="blocked" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-destructive/25')
  })

  it('applies muted tint for neutral / informational tiles', () => {
    render(
      <ScoopCard tint="neutral" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-muted/60')
  })

  it('marks the active card with an accent-blue ring', () => {
    render(
      <ScoopCard tint="ready" icon={<span>i</span>} active>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop-card-root')).toHaveClass(
      'ring-2',
      'ring-accent-blue'
    )
  })
})
