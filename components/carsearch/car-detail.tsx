import Link from 'next/link'

import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react'

import {
  awdCopy,
  driverAssistCopy,
  formatMiles,
  formatPrice,
  listedAgeCopy,
  rangeCopy,
  warrantyCopy
} from '@/lib/carsearch/copy'
import type {
  CarsearchListing,
  CarsearchPriceHistory,
  CarsearchSavedListing
} from '@/lib/carsearch/types'

import { Button } from '@/components/ui/button'

import { CarsearchListingImage } from './listing-image'
import { SavedControls } from './saved-controls'

function priceHistorySummary(
  listing: CarsearchListing,
  priceHistory: CarsearchPriceHistory[]
) {
  if (!priceHistory.length) return 'No price changes tracked yet.'
  const oldest = priceHistory[priceHistory.length - 1]
  const latestChange = priceHistory.find(point => point.price !== listing.price)

  if (!latestChange && oldest.price === listing.price) {
    return `First observed at ${formatPrice(oldest.price)}. No price changes yet.`
  }

  const delta = listing.price - oldest.price
  const direction = delta < 0 ? 'down' : 'up'
  return `Current price is ${direction} ${formatPrice(Math.abs(delta))} from first observation.`
}

function featureRows(listing: CarsearchListing) {
  return [
    awdCopy(listing.awd),
    driverAssistCopy(listing),
    rangeCopy(listing.epaRangeMiles),
    warrantyCopy(listing)
  ].filter((feature): feature is NonNullable<typeof feature> =>
    Boolean(feature)
  )
}

export function CarsearchCarDetail({
  listing,
  priceHistory,
  saved,
  canManage
}: {
  listing: CarsearchListing
  priceHistory: CarsearchPriceHistory[]
  saved: CarsearchSavedListing | null
  canManage: boolean
}) {
  const listed = listedAgeCopy(listing.listedSince)
  const verifyAssist = listing.assist === 'verify'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-950"
        href="/carsearch"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Back to all cars
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="h-72 bg-zinc-200 sm:h-[420px]">
              <CarsearchListingImage
                className="h-full w-full object-cover"
                listing={listing}
              />
            </div>
            {listing.topPick ? (
              <span className="absolute left-4 top-4 rounded-full bg-emerald-700 px-3 py-1 text-sm font-semibold text-white">
                Top pick
              </span>
            ) : null}
          </div>

          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">About this car</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              {featureRows(listing).map(feature => (
                <li className="flex gap-2" key={feature.text}>
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-700" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {listing.topPick ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="text-lg font-semibold text-emerald-950">
                Why this is one of our top picks
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-950">
                {listing.topPickReason ??
                  'Strong match on price, miles, and safety features.'}
              </p>
            </section>
          ) : null}

          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">
              What to verify before buying
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-700">
              <li>Run a fresh CARFAX or AutoCheck report at the dealer.</li>
              {verifyAssist ? (
                <li>
                  Confirm the driver-assist feature on the original window
                  sticker before committing.
                </li>
              ) : null}
              <li>Check tire wear. EV tires can be expensive.</li>
              <li>Ask about battery state of health and warranty transfer.</li>
              <li>
                {listing.cpo
                  ? 'Confirm the certified warranty terms in writing.'
                  : 'Ask what factory or extended warranty coverage remains.'}
              </li>
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {listing.brand} · {listing.model}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {listing.year} {listing.modelLabel}
            </h1>
            <p className="mt-1 text-zinc-600">{listing.trim}</p>
            <div className="mt-5 text-4xl font-semibold">
              {formatPrice(listing.price)}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {listing.deal === 'great price'
                ? 'Below market price'
                : 'Asking price'}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-zinc-200 p-3">
                <div className="text-xs uppercase text-zinc-500">Mileage</div>
                <div className="font-semibold">
                  {formatMiles(listing.miles)}
                </div>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <div className="text-xs uppercase text-zinc-500">Range</div>
                <div className="font-semibold">{listing.epaRangeMiles} mi</div>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <div className="text-xs uppercase text-zinc-500">Distance</div>
                <div className="font-semibold">{listing.distanceMiles} mi</div>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <div className="text-xs uppercase text-zinc-500">Listed</div>
                <div className="font-semibold">{listed?.text ?? 'Unknown'}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                asChild
                className="min-h-11 bg-zinc-950 text-white hover:bg-zinc-800 hover:text-white"
              >
                <a
                  href={listing.sourceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View live listing
                  <ExternalLink aria-hidden className="h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                className="min-h-11 border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 hover:text-zinc-950"
                variant="outline"
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    listing.location
                  )}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <MapPin aria-hidden className="h-4 w-4" />
                  Open map
                </a>
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Price history</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {priceHistorySummary(listing, priceHistory)}
            </p>
          </section>

          <SavedControls
            canManage={canManage}
            saved={saved}
            vin={listing.vin}
          />
        </aside>
      </div>
    </div>
  )
}
