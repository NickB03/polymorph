import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import vm from 'node:vm'

type RawListing = {
  id: string
  imageUrl?: string
  brand: string
  model: string
  modelLabel: string
  year: number
  trim: string
  trimType: string
  awd: boolean
  price: number
  miles: number
  range: number
  location: string
  distance: number
  locType: string
  deal?: string
  cpo: boolean
  assist: string
  lemon: boolean
  topPick?: boolean
  features?: string[]
  url: string
  listedSince?: string
}

const sourceArg = process.argv.find(arg => arg.startsWith('--source='))
const outArg = process.argv.find(arg => arg.startsWith('--out='))

if (!sourceArg || !outArg) {
  console.error(
    'Usage: bun run scripts/carsearch/import-ev-tracker-snapshot.ts --source=/path/to/data.js --out=lib/carsearch/seed/ev-tracker-snapshot.json'
  )
  process.exit(1)
}

const source = sourceArg.slice('--source='.length)
const out = outArg.slice('--out='.length)
const code = `${await readFile(source, 'utf8')}\nthis.LISTINGS = LISTINGS`
const sandbox: { LISTINGS?: RawListing[] } = {}

vm.createContext(sandbox)
vm.runInContext(code, sandbox)

if (!Array.isArray(sandbox.LISTINGS)) {
  throw new Error('LISTINGS array was not found in source data.js')
}

const snapshotDate = '2026-05-28T00:00:00.000Z'
const topPickReasons: Record<string, string> = {
  '3FMTK3SU8SMA01062':
    'Lowest price for a near-new Certified Ford with hands-free driving. Texas-based dealer - no shipping needed.',
  '3FMTK4SX5SMA11550':
    'Most range of any car on the list (306 mi) and Ford Certified. Sportier GT version.',
  '3FMTK3R78PMA65898':
    "Best 2023 deal close to home (18 mi). Includes Ford's hands-free highway system.",
  YV4ED3GM3P2026771:
    'Same safety system as your XC90, Volvo Certified, lowest miles among Volvos.',
  YV4ED3UM0P2011701:
    'SUV version of the Volvo C40 - more cargo room. Certified with 7-year warranty.'
}

const normalized = sandbox.LISTINGS.map(listing => ({
  vin: listing.id,
  brand: listing.brand,
  model: listing.model,
  modelLabel: listing.modelLabel,
  year: listing.year,
  trim: listing.trim,
  trimType: listing.trimType,
  awd: listing.awd,
  price: listing.price,
  miles: listing.miles,
  epaRangeMiles: listing.range,
  location: listing.location,
  distanceMiles: listing.distance,
  locationType: listing.locType,
  deal: listing.deal === '-' || listing.deal === '—' ? null : listing.deal,
  cpo: listing.cpo,
  assist: listing.assist,
  lemon: listing.lemon,
  topPick: !!listing.topPick,
  topPickReason: topPickReasons[listing.id] ?? null,
  features: listing.features ?? [],
  imageUrl: listing.imageUrl ?? null,
  sourceUrl: listing.url,
  sourceSite: 'edmunds',
  listedSince: listing.listedSince
    ? `${listing.listedSince}T00:00:00.000Z`
    : null,
  firstSeenAt: snapshotDate,
  lastSeenAt: snapshotDate,
  isActive: true
}))

await mkdir(dirname(out), { recursive: true })
await writeFile(out, `${JSON.stringify(normalized, null, 2)}\n`)

console.log(`Wrote ${normalized.length} listings to ${out}`)
