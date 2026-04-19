import { NextResponse } from 'next/server'

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'
import { getPrivilegedDb } from '@/lib/db/admin'
import { trendingSuggestionsCache } from '@/lib/db/schema'
import { flushTraces } from '@/lib/utils/telemetry'

export const maxDuration = 60

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[Suggestions refresh] CRON_SECRET is not configured')
    return NextResponse.json(
      { ok: false, error: 'not-configured' },
      { status: 500 }
    )
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { suggestions } = await generateTrendingSuggestions()
    const privilegedDb = getPrivilegedDb()

    await privilegedDb
      .insert(trendingSuggestionsCache)
      .values({ id: 1, suggestions, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: trendingSuggestionsCache.id,
        set: { suggestions, updatedAt: new Date() }
      })

    return NextResponse.json({
      ok: true,
      categories: Object.keys(suggestions)
    })
  } catch (error) {
    console.error('[Suggestions refresh] Failed:', error)
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
