import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DragOverlay } from './drag-overlay'

describe('DragOverlay', () => {
  it('hides its content from assistive tech when inactive', () => {
    render(<DragOverlay visible={false} />)

    expect(
      screen.getByText('Drop files here').parentElement?.parentElement
    ).toHaveAttribute('aria-hidden', 'true')
  })
})
