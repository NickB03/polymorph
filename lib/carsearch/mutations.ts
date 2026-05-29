import { eq } from 'drizzle-orm'

import type { CarsearchSavedStatus } from '@/lib/carsearch/types'
import { getPrivilegedDb } from '@/lib/db/admin'
import { carsearchSavedListings } from '@/lib/db/schema'

export async function saveCarsearchListing(input: {
  vin: string
  savedByUserId: string
  note?: string | null
}) {
  const privilegedDb = await getPrivilegedDb()
  const now = new Date()

  await privilegedDb
    .insert(carsearchSavedListings)
    .values({
      vin: input.vin,
      savedByUserId: input.savedByUserId,
      note: input.note ?? null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: carsearchSavedListings.vin,
      set: {
        savedByUserId: input.savedByUserId,
        note: input.note ?? null,
        updatedAt: now
      }
    })
}

export async function updateCarsearchSavedListing(input: {
  vin: string
  status?: CarsearchSavedStatus
  note?: string | null
}) {
  const privilegedDb = await getPrivilegedDb()
  const changes: Partial<typeof carsearchSavedListings.$inferInsert> = {
    updatedAt: new Date()
  }

  if (input.status) changes.status = input.status
  if ('note' in input) changes.note = input.note ?? null

  await privilegedDb
    .update(carsearchSavedListings)
    .set(changes)
    .where(eq(carsearchSavedListings.vin, input.vin))
}

export async function unsaveCarsearchListing(vin: string) {
  const privilegedDb = await getPrivilegedDb()

  await privilegedDb
    .delete(carsearchSavedListings)
    .where(eq(carsearchSavedListings.vin, vin))
}
