import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import EvalsDashboard from './dashboard'

describe('EvalsDashboard', () => {
  it('renders an empty state when no summaries exist', () => {
    render(
      <EvalsDashboard
        data={{
          latest: null,
          previous: null,
          trend: [],
          lastUpdated: null
        }}
      />
    )

    expect(screen.getByText('No eval summaries yet')).toBeInTheDocument()
    expect(
      screen.getByText(/run the capability eval suite/i)
    ).toBeInTheDocument()
  })
})
