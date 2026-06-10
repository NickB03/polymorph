'use client'

import Link from 'next/link'

import {
  AlertTriangle,
  BadgeCheck,
  Heart,
  Info,
  MapPin,
  ShieldCheck
} from 'lucide-react'

import {
  awdCopy,
  bodyType,
  brandLabel,
  driverAssistCopy,
  formatMiles,
  formatPrice,
  listedAgeCopy,
  rangeCopy,
  warrantyCopy
} from '@/lib/carsearch/copy'
import type { CarsearchListing } from '@/lib/carsearch/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import { CarsearchListingImage } from './listing-image'

function ToneIcon({ tone }: { tone: 'good' | 'warn' | 'info' }) {
  if (tone === 'good') {
    return (
      <BadgeCheck aria-hidden className="mt-0.5 h-4 w-4 text-emerald-700" />
    )
  }
  if (tone === 'warn') {
    return (
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 text-amber-700" />
    )
  }
  return <Info aria-hidden className="mt-0.5 h-4 w-4 text-zinc-500" />
}

function dealLabel(deal: CarsearchListing['deal']) {
  if (!deal) return null
  if (deal === 'great price') return 'Great price'
  if (deal === 'good price') return 'Good price'
  return 'Fair price'
}

export function CarsearchCarCard({
  listing,
  saved,
  canManage,
  onToggleSaved
}: {
  listing: CarsearchListing
  saved: boolean
  canManage: boolean
  onToggleSaved: (vin: string) => void
}) {
  const features = [
    awdCopy(listing.awd),
    driverAssistCopy(listing),
    rangeCopy(listing.epaRangeMiles),
    warrantyCopy(listing)
  ].filter((feature): feature is NonNullable<typeof feature> =>
    Boolean(feature)
  )
  const listed = listedAgeCopy(listing.listedSince)
  const deal = dealLabel(listing.deal)

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        listing.topPick
          ? 'border-emerald-300 ring-1 ring-emerald-100'
          : 'border-zinc-200'
      )}
      data-vin={listing.vin}
    >
      <div className="relative">
        <Link
          aria-label={`View ${listing.year} ${listing.modelLabel} details`}
          href={`/carsearch/${listing.vin}`}
        >
          <div className="h-56 overflow-hidden bg-zinc-200">
            <CarsearchListingImage
              className="h-full w-full object-cover"
              listing={listing}
            />
          </div>
        </Link>
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {listing.topPick ? (
            <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
              Top pick
            </span>
          ) : null}
          {deal ? (
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-zinc-800 shadow-sm">
              {deal}
            </span>
          ) : null}
        </div>
        <button
          aria-label={saved ? 'Remove saved listing' : 'Save listing'}
          className={cn(
            'absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60',
            saved && 'text-red-700'
          )}
          disabled={!canManage}
          onClick={() => onToggleSaved(listing.vin)}
          type="button"
        >
          <Heart
            aria-hidden
            className="h-5 w-5"
            fill={saved ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {brandLabel(listing.brand)} · {bodyType(listing)}
        </div>

        <div>
          <Link
            className="text-lg font-semibold leading-tight text-zinc-950 hover:text-emerald-800"
            href={`/carsearch/${listing.vin}`}
          >
            {`${listing.year} ${listing.modelLabel}`}
          </Link>
          <div className="mt-1 text-sm text-zinc-600">{listing.trim}</div>
        </div>

        {listing.topPick ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <div className="mb-1 font-semibold">Why we like it</div>
            <p className="leading-6">
              {listing.topPickReason ??
                'Strong match on price, miles, and safety features.'}
            </p>
          </div>
        ) : null}

        <div>
          <div className="text-3xl font-semibold tracking-tight">
            {formatPrice(listing.price)}
          </div>
          <div className="text-sm text-zinc-500">
            {listing.deal === 'great price'
              ? 'Below market price'
              : 'Asking price'}
          </div>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-zinc-200">
          <div className="border-r border-zinc-200 p-3">
            <div className="text-xs uppercase text-zinc-500">Mileage</div>
            <div className="font-semibold">{formatMiles(listing.miles)}</div>
          </div>
          <div className="p-3">
            <div className="text-xs uppercase text-zinc-500">Driving range</div>
            <div className="font-semibold">{listing.epaRangeMiles} mi</div>
          </div>
        </div>

        <ul className="space-y-2 text-sm">
          {features.map(feature => (
            <li className="flex gap-2" key={feature.text}>
              <ToneIcon tone={feature.tone} />
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
          <MapPin aria-hidden className="h-4 w-4" />
          <span>
            {listing.location} · {listing.distanceMiles} mi from you
          </span>
          {listed ? (
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-semibold',
                listed.tone === 'fresh' && 'bg-emerald-100 text-emerald-800',
                listed.tone === 'recent' && 'bg-zinc-100 text-zinc-700',
                listed.tone === 'stale' && 'bg-amber-100 text-amber-800'
              )}
            >
              {listed.text}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            className="min-h-11 flex-1 bg-zinc-950 text-white hover:bg-zinc-800 hover:text-white"
          >
            <Link href={`/carsearch/${listing.vin}`}>View details</Link>
          </Button>
          <Button
            className="min-h-11 flex-1 border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 hover:text-zinc-950 disabled:bg-white disabled:text-zinc-500"
            disabled={!canManage}
            onClick={() => onToggleSaved(listing.vin)}
            type="button"
            variant="outline"
          >
            <ShieldCheck aria-hidden className="h-4 w-4" />
            {canManage ? (saved ? 'Saved' : 'Save') : 'Sign in to save'}
          </Button>
        </div>
      </div>
    </article>
  )
}
