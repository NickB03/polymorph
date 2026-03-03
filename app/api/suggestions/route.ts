import { NextResponse } from 'next/server'

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'
import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'
import { getRedis } from '@/lib/rate-limit/redis'

const CACHE_KEY = 'trending:suggestions'
const CACHE_TTL = 14400 // 4 hours in seconds

export async function GET() {
  try {
    const redis = getRedis()

    // Try cache first
    // Upstash automatically serializes (JSON.stringify) on set and
    // deserializes (JSON.parse) on get, so we store/retrieve the
    // object directly — no manual JSON.stringify/parse needed.
    if (redis) {
      const cached = await redis.get<Record<string, string[]>>(CACHE_KEY)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    // Cache miss — generate fresh suggestions
    const suggestions = await generateTrendingSuggestions()

    // Cache the result
    if (redis) {
      await redis.set(CACHE_KEY, suggestions, {
        ex: CACHE_TTL
      })
    }

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Suggestions API error:', error)
    return NextResponse.json(DEFAULT_SUGGESTIONS)
  }
}
