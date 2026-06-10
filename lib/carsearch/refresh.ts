import { eq } from 'drizzle-orm'

import { parseEdmundsSearchPage } from '@/lib/carsearch/parsers/edmunds'
import { carsearchSources } from '@/lib/carsearch/sources'
import { getPrivilegedDb } from '@/lib/db/admin'
import {
  type CarsearchListingRow,
  carsearchListings,
  carsearchPriceHistory,
  carsearchRefreshRuns,
  generateId
} from '@/lib/db/schema'

type RefreshCounts = {
  seenCount: number
  insertedCount: number
  updatedCount: number
  deactivatedCount: number
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function asDate(value: string | null) {
  return value ? new Date(value) : null
}

async function fetchSource(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent':
        'Mozilla/5.0 (compatible; PolymorphCarsearch/1.0; +https://polymorph.fyi/carsearch)'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

export async function refreshCarsearchListings(): Promise<RefreshCounts> {
  const privilegedDb = await getPrivilegedDb()
  const runId = generateId()
  const startedAt = new Date()

  await privilegedDb.insert(carsearchRefreshRuns).values({
    id: runId,
    sourceSite: 'edmunds',
    status: 'running',
    startedAt
  })

  const counts: RefreshCounts = {
    seenCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    deactivatedCount: 0
  }
  const seenVins = new Set<string>()

  try {
    for (const [index, source] of carsearchSources.entries()) {
      const html = await fetchSource(source.url)
      const parsedListings = parseEdmundsSearchPage(html, source.url)

      for (const parsed of parsedListings) {
        seenVins.add(parsed.vin)
        counts.seenCount += 1

        const existingRows = await privilegedDb
          .select()
          .from(carsearchListings)
          .where(eq(carsearchListings.vin, parsed.vin))
          .limit(1)
        const existing = existingRows[0]
        const now = new Date()
        const firstSeenAt = existing?.firstSeenAt ?? now

        await privilegedDb
          .insert(carsearchListings)
          .values({
            ...parsed,
            listedSince: asDate(parsed.listedSince),
            topPick: existing?.topPick ?? false,
            topPickReason: existing?.topPickReason ?? null,
            firstSeenAt,
            lastSeenAt: now,
            isActive: true,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: carsearchListings.vin,
            set: {
              brand: parsed.brand,
              model: parsed.model,
              modelLabel: parsed.modelLabel,
              year: parsed.year,
              trim: parsed.trim,
              trimType: parsed.trimType,
              awd: parsed.awd,
              price: parsed.price,
              miles: parsed.miles,
              epaRangeMiles: parsed.epaRangeMiles,
              location: parsed.location,
              distanceMiles: parsed.distanceMiles,
              locationType: parsed.locationType,
              deal: parsed.deal,
              cpo: parsed.cpo,
              assist: parsed.assist,
              lemon: parsed.lemon,
              features: parsed.features,
              imageUrl: parsed.imageUrl,
              sourceUrl: parsed.sourceUrl,
              sourceSite: parsed.sourceSite,
              listedSince: asDate(parsed.listedSince),
              lastSeenAt: now,
              isActive: true,
              updatedAt: now
            }
          })

        if (existing) {
          counts.updatedCount += 1
        } else {
          counts.insertedCount += 1
        }

        if (!existing || existing.price !== parsed.price) {
          await privilegedDb.insert(carsearchPriceHistory).values({
            vin: parsed.vin,
            price: parsed.price,
            sourceSite: parsed.sourceSite,
            observedAt: now
          })
        }
      }

      if (index < carsearchSources.length - 1) {
        await sleep(1500)
      }
    }

    if (counts.seenCount === 0) {
      throw new Error(
        'Carsearch refresh parsed zero listings; refusing to deactivate existing inventory'
      )
    }

    const activeRows: Pick<CarsearchListingRow, 'vin'>[] = await privilegedDb
      .select({ vin: carsearchListings.vin })
      .from(carsearchListings)
      .where(eq(carsearchListings.sourceSite, 'edmunds'))

    for (const row of activeRows) {
      if (seenVins.has(row.vin)) continue
      await privilegedDb
        .update(carsearchListings)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(carsearchListings.vin, row.vin))
      counts.deactivatedCount += 1
    }

    await privilegedDb
      .update(carsearchRefreshRuns)
      .set({
        status: 'success',
        completedAt: new Date(),
        seenCount: counts.seenCount,
        insertedCount: counts.insertedCount,
        updatedCount: counts.updatedCount,
        deactivatedCount: counts.deactivatedCount
      })
      .where(eq(carsearchRefreshRuns.id, runId))

    return counts
  } catch (error) {
    await privilegedDb
      .update(carsearchRefreshRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'unknown'
      })
      .where(eq(carsearchRefreshRuns.id, runId))
    throw error
  }
}
