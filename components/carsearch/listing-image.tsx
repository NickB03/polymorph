'use client'

import { useState } from 'react'

import { CarFront } from 'lucide-react'

import type { CarsearchListing } from '@/lib/carsearch/types'

export function CarsearchListingImage({
  listing,
  className
}: {
  listing: CarsearchListing
  className?: string
}) {
  const [failed, setFailed] = useState(!listing.imageUrl)
  const alt = `${listing.year} ${listing.modelLabel} ${listing.trim}, ${listing.location}`

  if (failed || !listing.imageUrl) {
    return (
      <div
        aria-label={alt}
        className="flex h-full min-h-52 w-full items-center justify-center bg-zinc-200 text-zinc-500"
        role="img"
      >
        <CarFront aria-hidden className="h-24 w-24 stroke-1" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Dealer images need native onError fallback.
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
      src={listing.imageUrl}
    />
  )
}
