import { z } from 'zod'

import type { CarsearchListing } from '@/lib/carsearch/types'

import snapshot from './ev-tracker-snapshot.json'

const listingSchema = z.object({
  vin: z.string().min(11),
  brand: z.enum(['ford', 'volvo', 'polestar']),
  model: z.string().min(1),
  modelLabel: z.string().min(1),
  year: z.number().int().min(2018).max(2030),
  trim: z.string().min(1),
  trimType: z.string().min(1),
  awd: z.boolean(),
  price: z.number().int().positive(),
  miles: z.number().int().nonnegative(),
  epaRangeMiles: z.number().int().positive(),
  location: z.string().min(1),
  distanceMiles: z.number().int().nonnegative(),
  locationType: z.enum(['dfw', 'tx', 'online']),
  deal: z.enum(['great price', 'good price', 'fair price']).nullable(),
  cpo: z.boolean(),
  assist: z.enum(['std', 'verify', 'no']),
  lemon: z.boolean(),
  topPick: z.boolean(),
  topPickReason: z.string().nullable(),
  features: z.array(z.string()),
  imageUrl: z.string().url().nullable(),
  sourceUrl: z.string().url(),
  sourceSite: z.enum(['edmunds', 'carvana', 'dealer']),
  listedSince: z.string().datetime().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  isActive: z.boolean()
})

export const carsearchSeedListings = z
  .array(listingSchema)
  .parse(snapshot) satisfies CarsearchListing[]
