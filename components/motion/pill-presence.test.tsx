import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PillPresence } from './pill-presence'

describe('PillPresence', () => {
  it('renders children when activeKey is set', () => {
    render(
      <PillPresence activeKey="research">
        <span data-testid="pill">Research</span>
      </PillPresence>
    )

    expect(screen.getByTestId('pill')).toBeInTheDocument()
  })

  it('renders nothing when activeKey is null', () => {
    render(
      <PillPresence activeKey={null}>
        <span data-testid="pill">Research</span>
      </PillPresence>
    )

    expect(screen.queryByTestId('pill')).not.toBeInTheDocument()
  })
})
