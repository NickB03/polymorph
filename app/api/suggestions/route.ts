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
    if (redis) {
      const cached = await redis.get<string>(CACHE_KEY)
      if (cached) {
        return NextResponse.json(JSON.parse(cached))
      }
    }

    // Cache miss — generate fresh suggestions
    const suggestions = await generateTrendingSuggestions()

    // Cache the result
    if (redis) {
      await redis.set(CACHE_KEY, JSON.stringify(suggestions), {
        ex: CACHE_TTL
      })
    }

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Suggestions API error:', error)
    return NextResponse.json(DEFAULT_SUGGESTIONS)
  }
}
