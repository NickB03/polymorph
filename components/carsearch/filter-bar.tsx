'use client'

import type {
  CarsearchBrand,
  CarsearchFilters,
  CarsearchSortKey
} from '@/lib/carsearch/types'
import { cn } from '@/lib/utils'

const brands: Array<{ value: CarsearchBrand | 'all'; label: string }> = [
  { value: 'all', label: 'All brands' },
  { value: 'volvo', label: 'Volvo' },
  { value: 'ford', label: 'Ford' },
  { value: 'polestar', label: 'Polestar' }
]

const sortOptions: Array<{ value: CarsearchSortKey; label: string }> = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest listings' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'miles-asc', label: 'Lowest miles' },
  { value: 'range-desc', label: 'Longest range' },
  { value: 'distance-asc', label: 'Closest to home' }
]

export function CarsearchFilterBar({
  filters,
  visibleCount,
  totalCount,
  savedCount,
  onFiltersChange
}: {
  filters: CarsearchFilters
  visibleCount: number
  totalCount: number
  savedCount: number
  onFiltersChange: (filters: CarsearchFilters) => void
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="text-sm text-zinc-600">
          Showing <strong className="text-zinc-950">{visibleCount}</strong> of{' '}
          <strong className="text-zinc-950">{totalCount}</strong> cars ·{' '}
          <strong className="text-zinc-950">{savedCount}</strong> saved
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Brand filter"
          >
            {brands.map(brand => (
              <button
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-semibold transition',
                  filters.brand === brand.value
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                )}
                key={brand.value}
                onClick={() =>
                  onFiltersChange({ ...filters, brand: brand.value })
                }
                type="button"
              >
                {brand.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold">
              <input
                checked={filters.confirmedOnly}
                className="h-4 w-4 accent-zinc-950"
                onChange={event =>
                  onFiltersChange({
                    ...filters,
                    confirmedOnly: event.target.checked
                  })
                }
                type="checkbox"
              />
              Verified driver assist
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold">
              <input
                aria-label="Saved only"
                checked={filters.savedOnly}
                className="h-4 w-4 accent-zinc-950"
                onChange={event =>
                  onFiltersChange({
                    ...filters,
                    savedOnly: event.target.checked
                  })
                }
                role="switch"
                type="checkbox"
              />
              Saved only
            </label>
            <label className="sr-only" htmlFor="carsearch-sort">
              Sort listings
            </label>
            <select
              aria-label="Sort listings"
              className="min-h-11 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800"
              id="carsearch-sort"
              onChange={event =>
                onFiltersChange({
                  ...filters,
                  sort: event.target.value as CarsearchSortKey
                })
              }
              value={filters.sort}
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
