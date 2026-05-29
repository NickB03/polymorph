import { desc, eq } from 'drizzle-orm'

import type {
  CarsearchListing,
  CarsearchPriceHistory,
  CarsearchRefreshRun,
  CarsearchSavedListing
} from '@/lib/carsearch/types'
import { db } from '@/lib/db'
import { getPrivilegedDb } from '@/lib/db/admin'
import {
  type CarsearchListingRow,
  carsearchListings,
  carsearchPriceHistory,
  type CarsearchPriceHistoryRow,
  type CarsearchRefreshRunRow,
  carsearchRefreshRuns,
  type CarsearchSavedListingRow,
  carsearchSavedListings
} from '@/lib/db/schema'

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

function toNullableIso(value: Date | string | null) {
  if (!value) return null
  return toIso(value)
}

export function toCarsearchListing(row: CarsearchListingRow): CarsearchListing {
  return {
    vin: row.vin,
    brand: row.brand,
    model: row.model,
    modelLabel: row.modelLabel,
    year: row.year,
    trim: row.trim,
    trimType: row.trimType,
    awd: row.awd,
    price: row.price,
    miles: row.miles,
    epaRangeMiles: row.epaRangeMiles,
    location: row.location,
    distanceMiles: row.distanceMiles,
    locationType: row.locationType,
    deal: row.deal,
    cpo: row.cpo,
    assist: row.assist,
    lemon: row.lemon,
    topPick: row.topPick,
    topPickReason: row.topPickReason,
    features: row.features,
    imageUrl: row.imageUrl,
    sourceUrl: row.sourceUrl,
    sourceSite: row.sourceSite as CarsearchListing['sourceSite'],
    listedSince: toNullableIso(row.listedSince),
    firstSeenAt: toIso(row.firstSeenAt),
    lastSeenAt: toIso(row.lastSeenAt),
    isActive: row.isActive
  }
}

export function toCarsearchSavedListing(
  row: CarsearchSavedListingRow
): CarsearchSavedListing {
  return {
    vin: row.vin,
    status: row.status,
    note: row.note,
    savedByUserId: row.savedByUserId,
    savedAt: toIso(row.savedAt),
    updatedAt: toIso(row.updatedAt)
  }
}

export function toCarsearchPriceHistory(
  row: CarsearchPriceHistoryRow
): CarsearchPriceHistory {
  return {
    id: row.id,
    vin: row.vin,
    observedAt: toIso(row.observedAt),
    price: row.price,
    sourceSite: row.sourceSite
  }
}

export function toCarsearchRefreshRun(
  row: CarsearchRefreshRunRow
): CarsearchRefreshRun {
  return {
    id: row.id,
    startedAt: toIso(row.startedAt),
    completedAt: toNullableIso(row.completedAt),
    status: row.status,
    sourceSite: row.sourceSite,
    seenCount: row.seenCount,
    insertedCount: row.insertedCount,
    updatedCount: row.updatedCount,
    deactivatedCount: row.deactivatedCount,
    error: row.error
  }
}

export async function listActiveCarsearchListings() {
  const rows = await db
    .select()
    .from(carsearchListings)
    .where(eq(carsearchListings.isActive, true))

  return rows.map(toCarsearchListing)
}

export async function getCarsearchListing(vin: string) {
  const rows = await db
    .select()
    .from(carsearchListings)
    .where(eq(carsearchListings.vin, vin))
    .limit(1)

  return rows[0] ? toCarsearchListing(rows[0]) : null
}

export async function listCarsearchPriceHistory(vin: string) {
  const rows = await db
    .select()
    .from(carsearchPriceHistory)
    .where(eq(carsearchPriceHistory.vin, vin))
    .orderBy(desc(carsearchPriceHistory.observedAt))

  return rows.map(toCarsearchPriceHistory)
}

export async function getLatestCarsearchRefreshRun() {
  const rows = await db
    .select()
    .from(carsearchRefreshRuns)
    .orderBy(desc(carsearchRefreshRuns.startedAt))
    .limit(1)

  return rows[0] ? toCarsearchRefreshRun(rows[0]) : null
}

export async function listCarsearchSavedListingsForManager(canManage: boolean) {
  if (!canManage) return []

  const privilegedDb = await getPrivilegedDb()
  const rows = await privilegedDb.select().from(carsearchSavedListings)
  return rows.map(toCarsearchSavedListing)
}
