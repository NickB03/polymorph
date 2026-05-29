import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'

import { CarsearchCarDetail } from '../car-detail'

describe('CarsearchCarDetail', () => {
  it('renders top pick detail context and buying checklist', () => {
    const listing = carsearchSeedListings.find(item => item.topPick)!

    render(
      <CarsearchCarDetail
        canManage={false}
        listing={listing}
        priceHistory={[]}
        saved={null}
      />
    )

    expect(screen.getByText(/Back to all cars/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Why this is one of our top picks/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/What to verify before buying/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /view live listing/i })
    ).toHaveClass('text-white')
    expect(screen.getByRole('link', { name: /open map/i })).toHaveClass(
      'bg-white',
      'text-zinc-950'
    )
  })
})
