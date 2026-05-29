import { beforeEach, describe, expect, it, vi } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'
import { db } from '@/lib/db'

import {
  getCarsearchListing,
  listActiveCarsearchListings,
  listCarsearchPriceHistory
} from '../queries'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn()
  }
}))

vi.mock('@/lib/db/admin', () => ({
  getPrivilegedDb: vi.fn()
}))

function activeRows(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(rows))
  }
  return chain
}

function singleRows(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    where: vi.fn(() => chain)
  }
  return chain
}

function historyRows(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    where: vi.fn(() => chain)
  }
  return chain
}

describe('carsearch query fallbacks', () => {
  beforeEach(() => {
    vi.mocked(db.select).mockReset()
  })

  it('uses the seeded active listings when the deployed table is empty', async () => {
    vi.mocked(db.select).mockReturnValue(activeRows([]) as never)

    await expect(listActiveCarsearchListings()).resolves.toHaveLength(
      carsearchSeedListings.filter(listing => listing.isActive).length
    )
  })

  it('uses the seeded detail listing when the deployed table is empty', async () => {
    const listing = carsearchSeedListings[0]
    vi.mocked(db.select).mockReturnValue(singleRows([]) as never)

    await expect(getCarsearchListing(listing.vin)).resolves.toMatchObject({
      vin: listing.vin,
      modelLabel: listing.modelLabel
    })
  })

  it('uses the seeded first-observed price when history is empty', async () => {
    const listing = carsearchSeedListings[0]
    vi.mocked(db.select).mockReturnValue(historyRows([]) as never)

    await expect(listCarsearchPriceHistory(listing.vin)).resolves.toEqual([
      {
        id: `seed-${listing.vin}`,
        observedAt: listing.firstSeenAt,
        price: listing.price,
        sourceSite: listing.sourceSite,
        vin: listing.vin
      }
    ])
  })
})
