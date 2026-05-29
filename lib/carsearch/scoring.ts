import type {
  CarsearchFilters,
  CarsearchListing,
  CarsearchSortKey
} from '@/lib/carsearch/types'

export const defaultCarsearchFilters: CarsearchFilters = {
  brand: 'all',
  confirmedOnly: true,
  savedOnly: false,
  sort: 'recommended'
}

export function recommendationScore(listing: CarsearchListing) {
  let score = 0
  if (listing.topPick) score += 1000
  if (listing.assist === 'std') score += 100
  if (listing.awd) score += 100
  if (listing.cpo) score += 30
  if (listing.distanceMiles < 30) score += 50
  if (listing.epaRangeMiles >= 240) score += 30
  score -= listing.miles / 1000
  return score
}

export function filterListings(
  listings: CarsearchListing[],
  filters: CarsearchFilters,
  savedVins: Set<string>
) {
  return listings.filter(listing => {
    if (listing.lemon) return false
    if (!listing.isActive) return false
    if (filters.brand !== 'all' && listing.brand !== filters.brand) return false
    if (filters.confirmedOnly && (listing.assist !== 'std' || !listing.awd)) {
      return false
    }
    if (filters.savedOnly && !savedVins.has(listing.vin)) return false
    return true
  })
}

export function sortListings(
  listings: CarsearchListing[],
  sortKey: CarsearchSortKey
) {
  return [...listings].sort((a, b) => {
    if (sortKey === 'recommended')
      return recommendationScore(b) - recommendationScore(a)
    if (sortKey === 'newest') {
      return (b.listedSince ?? '').localeCompare(a.listedSince ?? '')
    }
    if (sortKey === 'price-asc') return a.price - b.price
    if (sortKey === 'price-desc') return b.price - a.price
    if (sortKey === 'miles-asc') return a.miles - b.miles
    if (sortKey === 'range-desc') return b.epaRangeMiles - a.epaRangeMiles
    if (sortKey === 'distance-asc') return a.distanceMiles - b.distanceMiles
    return 0
  })
}

export function splitTopPicks(
  listings: CarsearchListing[],
  sortKey: CarsearchSortKey
) {
  if (sortKey !== 'recommended') {
    return { topPicks: [], rest: listings }
  }

  return {
    topPicks: listings.filter(listing => listing.topPick),
    rest: listings.filter(listing => !listing.topPick)
  }
}
