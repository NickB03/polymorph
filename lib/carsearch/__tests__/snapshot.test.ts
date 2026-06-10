import { describe, expect, it } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'

describe('carsearch seed snapshot', () => {
  it('contains the imported EV Tracker snapshot', () => {
    expect(carsearchSeedListings).toHaveLength(42)
    expect(
      carsearchSeedListings.filter(listing => !listing.lemon)
    ).toHaveLength(41)
    expect(
      carsearchSeedListings.filter(listing => listing.topPick)
    ).toHaveLength(6)
  })

  it('preserves the expected source mix', () => {
    expect(
      carsearchSeedListings.filter(listing => listing.brand === 'ford')
    ).toHaveLength(26)
    expect(
      carsearchSeedListings.filter(listing => listing.brand === 'volvo')
    ).toHaveLength(13)
    expect(
      carsearchSeedListings.filter(listing => listing.brand === 'polestar')
    ).toHaveLength(3)
  })
})
