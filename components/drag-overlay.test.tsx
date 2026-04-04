import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DragOverlay } from './drag-overlay'

describe('DragOverlay', () => {
  it('hides its content from assistive tech when inactive', () => {
    const { container } = render(<DragOverlay visible={false} />)

    const overlay = container.firstElementChild as HTMLElement
    expect(overlay).toHaveAttribute('aria-hidden', 'true')
  })

  it('is visible to assistive tech when active', () => {
    const { container } = render(<DragOverlay visible={true} />)

    const overlay = container.firstElementChild as HTMLElement
    expect(overlay).toHaveAttribute('aria-hidden', 'false')
  })
})
