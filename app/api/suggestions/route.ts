import { NextResponse } from 'next/server'

import { and, eq, gt, sql } from 'drizzle-orm'

import {
  dayOfEpoch,
  selectDailySuggestionsFromPool
} from '@/lib/constants/default-suggestions'
import { db } from '@/lib/db'
import { trendingSuggestionsCache } from '@/lib/db/schema'
import type { SuggestionCategory } from '@/lib/types'
import { flushTraces } from '@/lib/utils/telemetry'

const CDN_MAX_AGE = 21_600 // 6 hours
const CDN_SWR_WINDOW = 86_400 // 24 hours
const BLEND_DYNAMIC_PER_CATEGORY = 2

type SuggestionsResponseSource = 'dynamic-blend' | 'static-rotation'

function toSuggestionsResponse(
  suggestions: Record<SuggestionCategory, string[]>,
  source: SuggestionsResponseSource
) {
  const headers = new Headers({
    'x-suggestions-source': source,
    'CDN-Cache-Control': `public, s-maxage=${CDN_MAX_AGE}, stale-while-revalidate=${CDN_SWR_WINDOW}`,
    'Cache-Control': `public, max-age=0, s-maxage=${CDN_MAX_AGE}, stale-while-revalidate=${CDN_SWR_WINDOW}`
  })
  return NextResponse.json(suggestions, { headers })
}

function blend(
  dynamic: Record<SuggestionCategory, string[]>,
  rotated: Record<SuggestionCategory, string[]>,
  dynamicPerCategory: number
): Record<SuggestionCategory, string[]> {
  const categories = Object.keys(rotated) as SuggestionCategory[]
  const out = {} as Record<SuggestionCategory, string[]>
  for (const category of categories) {
    const target = rotated[category].length
    const dynamicSlice = (dynamic[category] ?? []).slice(0, dynamicPerCategory)
    const staticSlice = rotated[category]
      .filter(item => !dynamicSlice.includes(item))
      .slice(0, target - dynamicSlice.length)
    out[category] = [...dynamicSlice, ...staticSlice]
  }
  return out
}

async function readDynamicCache(): Promise<Record<
  SuggestionCategory,
  string[]
> | null> {
  const rows = await db
    .select({ suggestions: trendingSuggestionsCache.suggestions })
    .from(trendingSuggestionsCache)
    .where(
      and(
        eq(trendingSuggestionsCache.id, 1),
        gt(trendingSuggestionsCache.updatedAt, sql`now() - interval '25 hours'`)
      )
    )
    .limit(1)

  const suggestions = rows[0]?.suggestions
  return (suggestions ?? null) as Record<SuggestionCategory, string[]> | null
}

export async function GET() {
  try {
    const rotated = selectDailySuggestionsFromPool(dayOfEpoch())

    let dynamic: Record<SuggestionCategory, string[]> | null = null
    try {
      dynamic = await readDynamicCache()
    } catch (dbError) {
      console.warn(
        '[Suggestions] DB read failed; serving pure static rotation.',
        dbError
      )
    }

    if (dynamic) {
      return toSuggestionsResponse(
        blend(dynamic, rotated, BLEND_DYNAMIC_PER_CATEGORY),
        'dynamic-blend'
      )
    }

    return toSuggestionsResponse(rotated, 'static-rotation')
  } finally {
    await flushTraces()
  }
}
