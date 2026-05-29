import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'
import type { CarsearchSavedListing } from '@/lib/carsearch/types'

import { CarsearchBrowseShell } from '../browse-shell'

const savedListings: CarsearchSavedListing[] = [
  {
    vin: '3FMTK3R78PMA65898',
    status: 'saved',
    note: null,
    savedByUserId: 'user-1',
    savedAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z'
  }
]

describe('CarsearchBrowseShell', () => {
  it('renders the default confirmed AWD shopping set', () => {
    render(
      <CarsearchBrowseShell
        listings={carsearchSeedListings}
        savedListings={[]}
        canManage={false}
        refreshRun={null}
      />
    )

    expect(screen.getByText(/EV options for your commute/i)).toBeInTheDocument()
    expect(screen.queryByText(/RWD ONLY/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: /our top picks/i })
    ).toBeInTheDocument()
  })

  it('filters to saved listings only', () => {
    render(
      <CarsearchBrowseShell
        listings={carsearchSeedListings}
        savedListings={savedListings}
        canManage
        refreshRun={null}
      />
    )

    fireEvent.click(screen.getByRole('switch', { name: /saved only/i }))

    const grid = screen.getByTestId('carsearch-listing-grid')
    expect(within(grid).getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText(/Freeman Toyota/i)).toBeInTheDocument()
  })

  it('hides top picks when sorting by price', () => {
    render(
      <CarsearchBrowseShell
        listings={carsearchSeedListings}
        savedListings={[]}
        canManage={false}
        refreshRun={null}
      />
    )

    fireEvent.change(screen.getByLabelText(/sort listings/i), {
      target: { value: 'price-asc' }
    })

    expect(
      screen.queryByRole('region', { name: /our top picks/i })
    ).not.toBeInTheDocument()
  })
})
