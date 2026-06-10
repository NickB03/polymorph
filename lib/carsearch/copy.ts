import type { CarsearchListing } from '@/lib/carsearch/types'

type CopyTone = 'good' | 'warn' | 'info'

export type FeatureCopy = {
  tone: CopyTone
  text: string
}

export function driverAssistCopy(
  listing: Pick<CarsearchListing, 'assist' | 'brand'>
): FeatureCopy {
  if (listing.assist === 'std' && listing.brand === 'ford') {
    return {
      tone: 'good',
      text: 'Hands-free driving on highways (BlueCruise)'
    }
  }

  if (listing.assist === 'std') {
    return {
      tone: 'good',
      text: 'Same safety system as your XC90 (Pilot Assist)'
    }
  }

  if (listing.assist === 'verify' && listing.brand === 'ford') {
    return { tone: 'warn', text: 'Hands-free driving - verify with dealer' }
  }

  if (listing.assist === 'verify') {
    return { tone: 'warn', text: 'Safety system optional - verify with dealer' }
  }

  return { tone: 'info', text: 'Driver assist not confirmed' }
}

export function rangeCopy(rangeMiles: number): FeatureCopy {
  if (rangeMiles >= 240) {
    return {
      tone: 'good',
      text: `${rangeMiles}-mile range - easy fit for your commute`
    }
  }

  if (rangeMiles >= 200) {
    return {
      tone: 'good',
      text: `${rangeMiles}-mile range - works with home charging`
    }
  }

  return {
    tone: 'warn',
    text: `${rangeMiles}-mile range - tight for daily drive`
  }
}

export function awdCopy(awd: boolean): FeatureCopy {
  if (awd) {
    return { tone: 'good', text: 'All-wheel drive' }
  }

  return { tone: 'warn', text: 'Front-wheel drive - not what you wanted' }
}

export function warrantyCopy(
  listing: Pick<CarsearchListing, 'brand' | 'cpo'>
): FeatureCopy | null {
  if (!listing.cpo) return null

  if (listing.brand === 'volvo') {
    return { tone: 'good', text: 'Volvo Certified - 7yr / 100k warranty' }
  }

  if (listing.brand === 'ford') {
    return { tone: 'good', text: 'Ford EV Certified - extended warranty' }
  }

  if (listing.brand === 'polestar') {
    return { tone: 'good', text: 'Polestar Certified - extended warranty' }
  }

  return { tone: 'good', text: 'Manufacturer Certified' }
}

export function bodyType(listing: Pick<CarsearchListing, 'model'>) {
  if (listing.model === 'xc40') return 'SUV'
  if (listing.model === 'c40') return 'Crossover'
  if (listing.model === 'mach-e') return 'SUV'
  if (listing.model === 'polestar2') return 'Sedan'
  return 'EV'
}

export function brandLabel(brand: CarsearchListing['brand']) {
  if (brand === 'volvo') return 'Volvo'
  if (brand === 'ford') return 'Ford'
  return 'Polestar'
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(price)
}

export function formatMiles(miles: number) {
  return `${new Intl.NumberFormat('en-US').format(miles)} mi`
}

export function listedAgeCopy(
  listedSince: string | Date | null,
  now = new Date()
) {
  if (!listedSince) return null
  const listedDate =
    listedSince instanceof Date ? listedSince : new Date(listedSince)
  const days = Math.floor(
    (now.getTime() - listedDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (Number.isNaN(days)) return null
  if (days <= 7) return { tone: 'fresh' as const, text: 'New listing' }
  if (days > 90) return { tone: 'stale' as const, text: `Sitting ${days}d` }
  return { tone: 'recent' as const, text: `Listed ${days}d ago` }
}
