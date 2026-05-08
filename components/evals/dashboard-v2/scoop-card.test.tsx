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

  it('applies the success-bg tint class for ready status', () => {
    render(
      <ScoopCard tint="ready" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-success-bg')
  })

  it('applies the warning-bg tint class for watch status', () => {
    render(
      <ScoopCard tint="watch" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-warning-bg')
  })

  it('applies destructive tint for blocked status', () => {
    render(
      <ScoopCard tint="blocked" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-destructive/15')
  })

  it('applies muted tint for neutral / informational tiles', () => {
    render(
      <ScoopCard tint="neutral" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-muted')
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
