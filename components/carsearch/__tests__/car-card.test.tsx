import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'

import { CarsearchCarCard } from '../car-card'

describe('CarsearchCarCard', () => {
  it('renders preserved plain-language labels and top pick reason', () => {
    const listing = carsearchSeedListings.find(item => item.topPick)!

    render(
      <CarsearchCarCard
        listing={listing}
        saved={false}
        canManage
        onToggleSaved={vi.fn()}
      />
    )

    expect(screen.getByText(/All-wheel drive/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Hands-free driving on highways|Same safety system/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: `${listing.year} ${listing.modelLabel}`
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/Why we like it/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view details/i })).toHaveClass(
      'text-white'
    )
    expect(screen.getByRole('button', { name: /^save$/i })).toHaveClass(
      'bg-white',
      'text-zinc-950'
    )
  })
})
