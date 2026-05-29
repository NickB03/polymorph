import { NextResponse } from 'next/server'

import { refreshCarsearchListings } from '@/lib/carsearch/refresh'
import { flushTraces } from '@/lib/utils/telemetry'

export const maxDuration = 60

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'not-configured' },
      { status: 500 }
    )
  }

  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const result = await refreshCarsearchListings()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown'
      },
      { status: 500 }
    )
  } finally {
    await flushTraces()
  }
}
