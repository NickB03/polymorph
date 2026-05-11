import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Delta } from './delta'

describe('<Delta />', () => {
  it('renders an up arrow + + sign + success color for positive values', () => {
    const { container } = render(<Delta value={0.05} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('text-success')
    expect(root.querySelector('[data-testid="delta-icon-up"]')).not.toBeNull()
    expect(screen.getByText('+5')).toBeInTheDocument()
  })

  it('renders a down arrow + minus sign + destructive color for negative values', () => {
    const { container } = render(<Delta value={-0.05} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('text-destructive')
    expect(root.querySelector('[data-testid="delta-icon-down"]')).not.toBeNull()
    expect(screen.getByText('-5')).toBeInTheDocument()
  })

  it('renders a flat icon + muted color for zero / rounded-to-zero', () => {
    const { container } = render(<Delta value={0.001} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('text-muted-foreground')
    expect(root.querySelector('[data-testid="delta-icon-flat"]')).not.toBeNull()
  })

  it('renders an em dash for null (no comparison data)', () => {
    render(<Delta value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
