import * as dotenv from 'dotenv'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'
import * as relations from '@/lib/db/relations'
import { carsearchListings, carsearchPriceHistory } from '@/lib/db/schema'
import * as schema from '@/lib/db/schema'

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  dotenv.config({ path: '.env.local' })
}

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error('DATABASE_URL or POSTGRES_URL is required to seed carsearch')
}

const client = postgres(connectionString, {
  ssl:
    process.env.DATABASE_SSL_DISABLED === 'true'
      ? false
      : { rejectUnauthorized: false },
  prepare: false,
  max: 5
})

const db = drizzle(client, {
  schema: { ...schema, ...relations }
})
const now = new Date()

for (const listing of carsearchSeedListings) {
  const listedSince = listing.listedSince ? new Date(listing.listedSince) : null
  const firstSeenAt = new Date(listing.firstSeenAt)
  const lastSeenAt = new Date(listing.lastSeenAt)

  await db
    .insert(carsearchListings)
    .values({
      vin: listing.vin,
      brand: listing.brand,
      model: listing.model,
      modelLabel: listing.modelLabel,
      year: listing.year,
      trim: listing.trim,
      trimType: listing.trimType,
      awd: listing.awd,
      price: listing.price,
      miles: listing.miles,
      epaRangeMiles: listing.epaRangeMiles,
      location: listing.location,
      distanceMiles: listing.distanceMiles,
      locationType: listing.locationType,
      deal: listing.deal,
      cpo: listing.cpo,
      assist: listing.assist,
      lemon: listing.lemon,
      topPick: listing.topPick,
      topPickReason: listing.topPickReason,
      features: listing.features,
      imageUrl: listing.imageUrl,
      sourceUrl: listing.sourceUrl,
      sourceSite: listing.sourceSite,
      listedSince,
      firstSeenAt,
      lastSeenAt,
      isActive: listing.isActive,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: carsearchListings.vin,
      set: {
        price: listing.price,
        miles: listing.miles,
        epaRangeMiles: listing.epaRangeMiles,
        location: listing.location,
        distanceMiles: listing.distanceMiles,
        deal: listing.deal,
        cpo: listing.cpo,
        assist: listing.assist,
        lemon: listing.lemon,
        topPick: listing.topPick,
        topPickReason: listing.topPickReason,
        imageUrl: listing.imageUrl,
        sourceUrl: listing.sourceUrl,
        listedSince,
        lastSeenAt,
        isActive: listing.isActive,
        updatedAt: now
      }
    })

  const existingPrice = await db
    .select({ price: carsearchPriceHistory.price })
    .from(carsearchPriceHistory)
    .where(eq(carsearchPriceHistory.vin, listing.vin))
    .limit(1)

  if (!existingPrice.length) {
    await db.insert(carsearchPriceHistory).values({
      vin: listing.vin,
      price: listing.price,
      sourceSite: listing.sourceSite,
      observedAt: firstSeenAt
    })
  }
}

await client.end()

console.log(`Seeded ${carsearchSeedListings.length} carsearch listings`)
