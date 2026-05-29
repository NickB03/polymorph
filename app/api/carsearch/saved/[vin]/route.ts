import { NextResponse } from 'next/server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import {
  unsaveCarsearchListing,
  updateCarsearchSavedListing
} from '@/lib/carsearch/mutations'

const patchSchema = z.object({
  status: z
    .enum(['saved', 'contacted', 'test_drive', 'rejected', 'purchased'])
    .optional(),
  note: z.string().max(2000).nullable().optional()
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vin: string }> }
) {
  const user = await getCurrentUser()
  if (!canManageCarsearch(user?.id)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid-body' },
      { status: 400 }
    )
  }

  const { vin } = await params
  await updateCarsearchSavedListing({ vin, ...parsed.data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ vin: string }> }
) {
  const user = await getCurrentUser()
  if (!canManageCarsearch(user?.id)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { vin } = await params
  await unsaveCarsearchListing(vin)
  return NextResponse.json({ ok: true })
}
