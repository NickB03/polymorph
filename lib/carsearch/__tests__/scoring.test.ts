import { describe, expect, it } from 'vitest'

import {
  defaultCarsearchFilters,
  filterListings,
  recommendationScore,
  sortListings,
  splitTopPicks
} from '@/lib/carsearch/scoring'
import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'

describe('carsearch scoring', () => {
  it('matches the static EV Tracker recommendation formula', () => {
    const listing = carsearchSeedListings.find(
      item => item.vin === '3FMTK3R78PMA65898'
    )

    expect(listing).toBeDefined()
    expect(recommendationScore(listing!)).toBeCloseTo(1265.35)
  })

  it('defaults to non-lemon active confirmed AWD listings', () => {
    const filtered = filterListings(
      carsearchSeedListings,
      defaultCarsearchFilters,
      new Set()
    )

    expect(filtered.every(listing => !listing.lemon)).toBe(true)
    expect(filtered.every(listing => listing.isActive)).toBe(true)
    expect(
      filtered.every(listing => listing.assist === 'std' && listing.awd)
    ).toBe(true)
  })

  it('splits top picks only for recommended sort', () => {
    const sorted = sortListings(carsearchSeedListings, 'recommended')

    expect(splitTopPicks(sorted, 'recommended').topPicks).toHaveLength(6)
    expect(splitTopPicks(sorted, 'price-asc').topPicks).toHaveLength(0)
  })
})
