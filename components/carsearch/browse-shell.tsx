'use client'

import { useMemo, useState } from 'react'

import {
  defaultCarsearchFilters,
  filterListings,
  sortListings,
  splitTopPicks
} from '@/lib/carsearch/scoring'
import type {
  CarsearchListing,
  CarsearchRefreshRun,
  CarsearchSavedListing
} from '@/lib/carsearch/types'

import { CarsearchAboutPanels } from './about-panels'
import { CarsearchCarCard } from './car-card'
import { CarsearchExternalLinks } from './external-links'
import { CarsearchFilterBar } from './filter-bar'
import { CarsearchHeader } from './header'

function savedMapFromRows(savedListings: CarsearchSavedListing[]) {
  return new Map(savedListings.map(saved => [saved.vin, saved]))
}

function refreshLabel(refreshRun: CarsearchRefreshRun | null) {
  if (!refreshRun) return 'Seeded snapshot'
  const date = new Date(refreshRun.completedAt ?? refreshRun.startedAt)
  return `Last refresh ${date.toLocaleDateString()}`
}

export function CarsearchBrowseShell({
  listings,
  savedListings,
  canManage,
  refreshRun
}: {
  listings: CarsearchListing[]
  savedListings: CarsearchSavedListing[]
  canManage: boolean
  refreshRun: CarsearchRefreshRun | null
}) {
  const [filters, setFilters] = useState(defaultCarsearchFilters)
  const [savedByVin, setSavedByVin] = useState(() =>
    savedMapFromRows(savedListings)
  )
  const savedVins = useMemo(() => new Set(savedByVin.keys()), [savedByVin])
  const activeListings = useMemo(
    () => listings.filter(listing => listing.isActive && !listing.lemon),
    [listings]
  )
  const sortedListings = useMemo(() => {
    return sortListings(
      filterListings(listings, filters, savedVins),
      filters.sort
    )
  }, [filters, listings, savedVins])
  const { topPicks, rest } = splitTopPicks(sortedListings, filters.sort)
  const showTopPicks =
    filters.sort === 'recommended' && !filters.savedOnly && topPicks.length > 0
  const gridListings = showTopPicks ? rest : sortedListings

  async function toggleSaved(vin: string) {
    if (!canManage) return

    const wasSaved = savedByVin.has(vin)
    setSavedByVin(previous => {
      const next = new Map(previous)
      if (wasSaved) {
        next.delete(vin)
      } else {
        next.set(vin, {
          vin,
          status: 'saved',
          note: null,
          savedByUserId: 'current-user',
          savedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }
      return next
    })

    const response = await fetch(
      wasSaved ? `/api/carsearch/saved/${vin}` : '/api/carsearch/saved',
      {
        method: wasSaved ? 'DELETE' : 'POST',
        headers: wasSaved ? undefined : { 'content-type': 'application/json' },
        body: wasSaved ? undefined : JSON.stringify({ vin })
      }
    )

    if (!response.ok) {
      setSavedByVin(savedMapFromRows(savedListings))
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CarsearchHeader />
      <CarsearchFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        savedCount={savedByVin.size}
        totalCount={activeListings.length}
        visibleCount={sortedListings.length}
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-2 border-b border-zinc-200 pb-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <div>{refreshLabel(refreshRun)}</div>
          <div>
            Public browsing is open. Saving and notes are available to approved
            household users.
          </div>
        </div>

        {showTopPicks ? (
          <section aria-label="Our top picks" className="mb-10">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                Our top picks for you
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Best matches for the commute, with the safety help you wanted.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {topPicks.map(listing => (
                <CarsearchCarCard
                  canManage={canManage}
                  key={listing.vin}
                  listing={listing}
                  onToggleSaved={toggleSaved}
                  saved={savedByVin.has(listing.vin)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="Matching cars">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              {showTopPicks ? 'More options' : 'All matching cars'}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Use the filters above to narrow down what you see.
            </p>
          </div>

          {gridListings.length ? (
            <div
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              data-testid="carsearch-listing-grid"
            >
              {gridListings.map(listing => (
                <CarsearchCarCard
                  canManage={canManage}
                  key={listing.vin}
                  listing={listing}
                  onToggleSaved={toggleSaved}
                  saved={savedByVin.has(listing.vin)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
              <h3 className="text-lg font-semibold">
                No cars match your filters
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                Try clearing a filter or turning off verified driver assist.
              </p>
            </div>
          )}
        </section>
      </div>

      <CarsearchExternalLinks />
      <CarsearchAboutPanels />
    </div>
  )
}
