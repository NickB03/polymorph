import { NextResponse } from 'next/server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import { saveCarsearchListing } from '@/lib/carsearch/mutations'

const bodySchema = z.object({
  vin: z.string().min(11),
  note: z.string().max(2000).nullable().optional()
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!canManageCarsearch(user?.id)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid-body' },
      { status: 400 }
    )
  }

  await saveCarsearchListing({
    vin: parsed.data.vin,
    note: parsed.data.note ?? null,
    savedByUserId: user!.id
  })

  return NextResponse.json({ ok: true })
}
