import { NextResponse } from 'next/server'

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'
import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'
import { getRedis } from '@/lib/rate-limit/redis'
import type { SuggestionCategory } from '@/lib/types'

const CACHE_KEY = 'trending:suggestions'
const CACHE_TTL = 14400 // 4 hours in seconds
const FALLBACK_CACHE_TTL = 900 // 15 minutes for static fallback output
const STALE_CACHE_KEY = 'trending:suggestions:stale'
const STALE_CACHE_TTL = 604800 // 7 days for last known good dynamic suggestions
const LOCK_KEY = 'trending:suggestions:lock'
const LOCK_TTL = 60 // 60 seconds — prevents stale locks if generation crashes
const LOCK_RETRY_DELAY_MS = 500
const LOCK_MAX_RETRIES = 6

type SuggestionsResponseSource = 'cache' | 'tavily' | 'brave' | 'default'

type SuggestionsServeMode = 'primary-cache' | 'fresh-generated' | 'stale-cache'

function toSuggestionsResponse(
  suggestions: Record<SuggestionCategory, string[]>,
  source: SuggestionsResponseSource,
  serveMode: SuggestionsServeMode,
  ttlSeconds?: number
) {
  const headers = new Headers({
    'x-suggestions-source': source,
    'x-suggestions-serve-mode': serveMode
  })

  if (typeof ttlSeconds === 'number') {
    headers.set('x-suggestions-cache-ttl', String(ttlSeconds))
  }

  return NextResponse.json(suggestions, { headers })
}

export async function GET() {
  try {
    const redis = getRedis()
    let lockAcquired = false

    // Try cache first
    // Upstash automatically serializes (JSON.stringify) on set and
    // deserializes (JSON.parse) on get, so we store/retrieve the
    // object directly — no manual JSON.stringify/parse needed.
    if (redis) {
      const cached =
        await redis.get<Record<SuggestionCategory, string[]>>(CACHE_KEY)
      if (cached) {
        return toSuggestionsResponse(cached, 'cache', 'primary-cache')
      }

      // Cache miss — try to acquire lock so only one request generates
      const acquired = await redis.set(LOCK_KEY, '1', {
        ex: LOCK_TTL,
        nx: true
      })
      lockAcquired = Boolean(acquired)

      if (!acquired) {
        // Another request is generating — wait for it to populate the cache
        for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
          await new Promise(r => setTimeout(r, LOCK_RETRY_DELAY_MS))
          const result =
            await redis.get<Record<SuggestionCategory, string[]>>(CACHE_KEY)
          if (result) {
            return toSuggestionsResponse(result, 'cache', 'primary-cache')
          }
        }
        // Lock holder may have failed — fall through to generate ourselves
      }
    }

    // Generate fresh suggestions (either we hold the lock, or Redis is unavailable)
    const { suggestions, source } = await generateTrendingSuggestions()

    let responseSuggestions = suggestions
    let serveMode: SuggestionsServeMode = 'fresh-generated'

    if (source === 'default' && redis) {
      const staleCached =
        await redis.get<Record<SuggestionCategory, string[]>>(STALE_CACHE_KEY)
      if (staleCached) {
        responseSuggestions = staleCached
        serveMode = 'stale-cache'
      }
    }

    // Cache the result and release the lock
    if (redis) {
      const effectiveTTL = source === 'default' ? FALLBACK_CACHE_TTL : CACHE_TTL

      await redis.set(CACHE_KEY, responseSuggestions, {
        ex: effectiveTTL
      })

      if (source !== 'default') {
        await redis.set(STALE_CACHE_KEY, responseSuggestions, {
          ex: STALE_CACHE_TTL
        })
      }

      if (lockAcquired) {
        await redis.del(LOCK_KEY)
      }

      if (source === 'default') {
        console.info('[Suggestions] Served fallback/default source.', {
          serveMode,
          cacheTtl: effectiveTTL
        })
      }

      return toSuggestionsResponse(
        responseSuggestions,
        source,
        serveMode,
        effectiveTTL
      )
    }

    return toSuggestionsResponse(responseSuggestions, source, serveMode)
  } catch (error) {
    console.error('Suggestions API error:', error)
    return toSuggestionsResponse(
      DEFAULT_SUGGESTIONS,
      'default',
      'fresh-generated'
    )
  }
}
