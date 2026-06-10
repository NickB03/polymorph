import { parse } from 'node-html-parser'

import type {
  CarsearchAssist,
  CarsearchBrand,
  CarsearchListing
} from '@/lib/carsearch/types'

export type ParsedCarsearchListing = Omit<
  CarsearchListing,
  'topPick' | 'topPickReason' | 'firstSeenAt' | 'lastSeenAt' | 'isActive'
>

type VehicleInput = {
  name?: string
  url?: string
  image?: string | string[]
  vehicleIdentificationNumber?: string
  vin?: string
  mileageFromOdometer?: { value?: number | string } | number | string
  offers?: { price?: number | string }
  description?: string
}

const vehicleCardSelector = [
  '[data-vin]',
  '[data-test="vehicle-card"]',
  '[data-testid="vehicle-card"]',
  '.vehicle-card',
  'article'
].join(',')

const titleSelector = [
  '[data-test="vehicle-title"]',
  '[data-testid="vehicle-title"]',
  'h2',
  'h3'
].join(',')

const priceSelector = [
  '[data-test*="price"]',
  '[data-testid*="price"]',
  '.price'
].join(',')

const mileageSelector = [
  '[data-test*="mileage"]',
  '[data-testid*="mileage"]',
  '[data-test*="odometer"]',
  '[data-testid*="odometer"]'
].join(',')

export function deriveAssist(input: {
  brand: CarsearchBrand
  year: number
  trim: string
  awd: boolean
}): CarsearchAssist {
  const trim = input.trim.toLowerCase()

  if (input.brand === 'volvo') {
    if (trim.includes('ultimate')) return 'std'
    if (trim.includes('plus') || trim.includes('core')) return 'verify'
  }

  if (input.brand === 'ford') {
    if (trim.includes('select')) return 'verify'
    if (trim.includes('premium') && input.awd) return 'std'
    if (trim.includes('gt') && input.year >= 2023) return 'std'
    return 'verify'
  }

  if (input.brand === 'polestar') {
    return 'verify'
  }

  return 'no'
}

function parseMoney(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace(/[^0-9]/g, ''))
  return parsed > 0 ? parsed : null
}

function parseInteger(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace(/[^0-9]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function cleanText(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

function firstNonEmpty(...values: (string | undefined | null)[]) {
  return values.map(value => cleanText(value ?? undefined)).find(Boolean) ?? ''
}

function imageUrl(value: VehicleInput['image']) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function vinFrom(value: VehicleInput) {
  const direct = value.vehicleIdentificationNumber ?? value.vin
  if (direct) return direct.toUpperCase()
  const match = value.url?.match(/vin\/([a-z0-9]+)/i)
  return match?.[1]?.toUpperCase() ?? null
}

function inferBrandModel(sourceUrl: string, name: string) {
  const haystack = `${sourceUrl} ${name}`.toLowerCase()
  if (haystack.includes('volvo-xc40')) {
    return {
      brand: 'volvo' as const,
      model: 'xc40',
      modelLabel: 'Volvo XC40 Recharge'
    }
  }
  if (haystack.includes('volvo') || haystack.includes('c40')) {
    return {
      brand: 'volvo' as const,
      model: 'c40',
      modelLabel: 'Volvo C40 Recharge'
    }
  }
  if (haystack.includes('polestar')) {
    return {
      brand: 'polestar' as const,
      model: 'polestar2',
      modelLabel: 'Polestar 2'
    }
  }
  return {
    brand: 'ford' as const,
    model: 'mach-e',
    modelLabel: 'Ford Mustang Mach-E'
  }
}

function yearFromName(name: string) {
  return Number(name.match(/\b(20\d{2})\b/)?.[1] ?? 0)
}

function trimFromName(name: string, modelLabel: string, year: number) {
  return name
    .replace(String(year), '')
    .replace(modelLabel, '')
    .replace('Ford Mustang Mach-E', '')
    .replace('Volvo C40 Recharge', '')
    .replace('Volvo XC40 Recharge', '')
    .replace('Polestar 2', '')
    .trim()
}

function rangeFromText(text: string, model: string) {
  const parsed = parseInteger(text.match(/(\d{3})\s*(?:mi|mile)/i)?.[1])
  if (parsed) return parsed
  if (model === 'mach-e') return 240
  if (model === 'polestar2') return 249
  if (model === 'xc40') return 223
  return 226
}

function dealFromText(text: string): CarsearchListing['deal'] {
  const normalized = text.toLowerCase()
  if (normalized.includes('great price')) return 'great price'
  if (normalized.includes('good price')) return 'good price'
  if (normalized.includes('fair price')) return 'fair price'
  return null
}

function locationFromText(text: string) {
  const locationMatch = text.match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*(TX|CA|IL|OK|AR|LA)\b/
  )
  return locationMatch ? locationMatch[0] : 'Dallas, TX'
}

function absoluteUrl(href: string | undefined, sourceUrl: string) {
  if (!href) return undefined

  try {
    return new URL(href, sourceUrl).toString()
  } catch {
    return href
  }
}

function normalizeVehicle(
  vehicle: VehicleInput,
  sourceUrl: string
): ParsedCarsearchListing | null {
  const name = vehicle.name ?? vehicle.description ?? ''
  const vin = vinFrom(vehicle)
  const price = parseMoney(vehicle.offers?.price)
  const year = yearFromName(name)
  const sourceListingUrl = vehicle.url
  const text = `${name} ${vehicle.description ?? ''}`

  if (!vin || !price || !year || !sourceListingUrl) return null

  const inferred = inferBrandModel(sourceUrl, name)
  const trim = trimFromName(name, inferred.modelLabel, year) || 'Unknown trim'
  const awd = /\b(awd|all-wheel|dual motor|twin motor)\b/i.test(text)
  const mileage =
    typeof vehicle.mileageFromOdometer === 'object' &&
    vehicle.mileageFromOdometer !== null
      ? parseInteger(vehicle.mileageFromOdometer.value)
      : parseInteger(vehicle.mileageFromOdometer)

  if (mileage === null) return null

  return {
    vin,
    ...inferred,
    year,
    trim,
    trimType: trim.toLowerCase().split(/\s+/)[0] ?? 'unknown',
    awd,
    price,
    miles: mileage,
    epaRangeMiles: rangeFromText(text, inferred.model),
    location: locationFromText(text),
    distanceMiles: 0,
    locationType: 'dfw',
    deal: dealFromText(text),
    cpo: /\b(certified|cpo)\b/i.test(text),
    assist: deriveAssist({ brand: inferred.brand, year, trim, awd }),
    lemon: /lemon status:\s*yes/i.test(text),
    features: [],
    imageUrl: imageUrl(vehicle.image),
    sourceUrl: sourceListingUrl,
    sourceSite: 'edmunds',
    listedSince: null
  }
}

function jsonLdVehicles(html: string) {
  const root = parse(html)
  return root
    .querySelectorAll('script[type="application/ld+json"]')
    .flatMap(script => {
      try {
        const parsed = JSON.parse(script.textContent)
        const objects = Array.isArray(parsed) ? parsed : [parsed]
        return objects.flatMap(item => {
          const elements = item.itemListElement ?? []
          if (!Array.isArray(elements)) return []
          return elements
            .map((element: { item?: VehicleInput }) => element.item)
            .filter(
              (vehicle: VehicleInput | undefined): vehicle is VehicleInput =>
                Boolean(vehicle)
            )
        })
      } catch {
        return []
      }
    })
}

function textMatch(value: string, pattern: RegExp) {
  return cleanText(value.match(pattern)?.[0])
}

function fallbackTitle(text: string) {
  return textMatch(
    text,
    /\b20\d{2}\s+(?:Ford Mustang Mach-E|Volvo (?:C40|XC40) Recharge|Polestar 2)[^$]+?(?=\s+\$|\s+\d{1,3},?\d{3}\s+miles|\s+\d{3}\s+mi|$)/i
  )
}

function domVehicles(html: string, sourceUrl: string): VehicleInput[] {
  const root = parse(html)

  return root.querySelectorAll(vehicleCardSelector).flatMap(card => {
    const text = cleanText(card.textContent)
    const vin =
      card.getAttribute('data-vin')?.toUpperCase() ??
      text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/)?.[0]?.toUpperCase()
    const anchor =
      card.querySelector('a[href*="/vin/"]') ?? card.querySelector('a[href]')
    const sourceListingUrl = absoluteUrl(
      anchor?.getAttribute('href'),
      sourceUrl
    )
    const priceText = firstNonEmpty(
      card.querySelector(priceSelector)?.textContent,
      text.match(/\$[\d,]+/)?.[0]
    )
    const mileageText = firstNonEmpty(
      card.querySelector(mileageSelector)?.textContent,
      text.match(/\b[\d,]+\s*(?:mi|miles)\b/i)?.[0]
    )
    const image = firstNonEmpty(
      card.querySelector('img')?.getAttribute('src'),
      card.querySelector('img')?.getAttribute('data-src')
    )
    const name = firstNonEmpty(
      card.querySelector(titleSelector)?.textContent,
      fallbackTitle(text)
    )

    if (!vin || !name || !priceText || !mileageText) return []

    return [
      {
        name,
        url: sourceListingUrl ?? sourceUrl,
        image: image || undefined,
        vehicleIdentificationNumber: vin,
        mileageFromOdometer: mileageText,
        offers: { price: priceText },
        description: text
      }
    ]
  })
}

export function parseEdmundsSearchPage(html: string, sourceUrl: string) {
  const jsonLd = jsonLdVehicles(html)

  return (jsonLd.length > 0 ? jsonLd : domVehicles(html, sourceUrl))
    .map(vehicle => normalizeVehicle(vehicle, sourceUrl))
    .filter((listing): listing is ParsedCarsearchListing => listing !== null)
}
