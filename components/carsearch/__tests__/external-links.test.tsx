import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CarsearchExternalLinks } from '../external-links'

describe('CarsearchExternalLinks', () => {
  it('uses readable accessible names without decorative arrows', () => {
    render(<CarsearchExternalLinks />)

    expect(
      screen.getByRole('link', {
        name: 'Search Edmunds - Ford: Mach-E listings around Dallas'
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', {
        name: /Ford->/
      })
    ).not.toBeInTheDocument()
  })
})
