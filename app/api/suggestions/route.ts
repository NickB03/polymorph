import { NextResponse } from 'next/server'

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'
import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'
import { getRedis } from '@/lib/rate-limit/redis'
import type {
  SuggestionCategory,
  TrendingSuggestionsFailureReason,
  TrendingSuggestionsPayload,
  TrendingSuggestionsSource
} from '@/lib/types'
import { flushTraces } from '@/lib/utils/telemetry'

export const maxDuration = 60

const CACHE_KEY = 'trending:suggestions'
const CACHE_TTL = 1800 // 30 minutes in seconds
const STALE_CACHE_KEY = 'trending:suggestions:stale'
const STALE_CACHE_TTL = 86400 // 24 hours for last known good dynamic suggestions
const LOCK_KEY = 'trending:suggestions:lock'
const LOCK_TTL = 60 // 60 seconds — prevents stale locks if generation crashes
const LOCK_RETRY_DELAY_MS = 500
const LOCK_MAX_RETRIES = 6

// Stale-while-revalidate window for CDN edge caching (Vercel)
const CDN_SWR_WINDOW = 300 // 5 minutes

type SuggestionsResponseSource = TrendingSuggestionsSource | 'cache'

type SuggestionsServeMode = 'primary-cache' | 'fresh-generated' | 'stale-cache'

type SuggestionsResponsePayload = {
  suggestions: Record<SuggestionCategory, string[]>
  meta: {
    source: SuggestionsResponseSource
    serveMode: SuggestionsServeMode
    servedFrom: SuggestionsServeMode
    generatedAt: string | null
    isFallback: boolean
    failureReason: TrendingSuggestionsFailureReason | null
  }
}

function isSuggestionsRecord(
  value: unknown
): value is Record<SuggestionCategory, string[]> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const suggestionKeys: SuggestionCategory[] = [
    'research',
    'compare',
    'latest',
    'summarize',
    'explain'
  ]

  return suggestionKeys.every(key =>
    Array.isArray((value as Record<string, unknown>)[key])
  )
}

function buildResponsePayload(
  payload: TrendingSuggestionsPayload,
  source: SuggestionsResponseSource,
  serveMode: SuggestionsServeMode
): SuggestionsResponsePayload {
  return {
    suggestions: payload.suggestions,
    meta: {
      source,
      serveMode,
      servedFrom: serveMode,
      generatedAt: source === 'cache' ? null : payload.meta.generatedAt,
      isFallback: payload.meta.isFallback,
      failureReason: payload.meta.failureReason
    }
  }
}

function buildLegacyCachedPayload(
  suggestions: Record<SuggestionCategory, string[]>,
  serveMode: SuggestionsServeMode
): SuggestionsResponsePayload {
  return {
    suggestions,
    meta: {
      source: 'cache',
      serveMode,
      servedFrom: serveMode,
      generatedAt: null,
      isFallback: false,
      failureReason: null
    }
  }
}

function toSuggestionsResponse(
  payload: SuggestionsResponsePayload,
  source: SuggestionsResponseSource,
  serveMode: SuggestionsServeMode,
  ttlSeconds?: number,
  options?: {
    noStore?: boolean
  }
) {
  if (options?.noStore) {
    const headers = new Headers({
      'x-suggestions-source': source,
      'x-suggestions-serve-mode': serveMode,
      'CDN-Cache-Control': 'no-store',
      'Cache-Control': 'no-store'
    })

    return NextResponse.json(payload, { headers })
  }

  const headers = new Headers({
    'x-suggestions-source': source,
    'x-suggestions-serve-mode': serveMode,
    'CDN-Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CDN_SWR_WINDOW}`,
    'Cache-Control': `public, max-age=0, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CDN_SWR_WINDOW}`
  })

  if (typeof ttlSeconds === 'number') {
    headers.set('x-suggestions-cache-ttl', String(ttlSeconds))
  }

  return NextResponse.json(payload, { headers })
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
      const cached = await redis.get<
        TrendingSuggestionsPayload | Record<SuggestionCategory, string[]>
      >(CACHE_KEY)
      if (cached) {
        const responsePayload = isSuggestionsRecord(cached)
          ? buildLegacyCachedPayload(cached, 'primary-cache')
          : buildResponsePayload(cached, 'cache', 'primary-cache')

        return toSuggestionsResponse(
          responsePayload,
          responsePayload.meta.source,
          'primary-cache',
          CACHE_TTL
        )
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
          const result = await redis.get<
            TrendingSuggestionsPayload | Record<SuggestionCategory, string[]>
          >(CACHE_KEY)
          if (result) {
            const responsePayload = isSuggestionsRecord(result)
              ? buildLegacyCachedPayload(result, 'primary-cache')
              : buildResponsePayload(result, 'cache', 'primary-cache')

            return toSuggestionsResponse(
              responsePayload,
              responsePayload.meta.source,
              'primary-cache',
              CACHE_TTL
            )
          }
        }
        // Lock holder may have failed — fall through to generate ourselves
      }
    }

    // Generate fresh suggestions (either we hold the lock, or Redis is unavailable)
    const generatedPayload = await generateTrendingSuggestions()

    let responsePayload = buildResponsePayload(
      generatedPayload,
      generatedPayload.source,
      'fresh-generated'
    )
    let serveMode: SuggestionsServeMode = 'fresh-generated'
    let responseSource: SuggestionsResponseSource = generatedPayload.source
    let noStore = generatedPayload.source === 'default'

    if (generatedPayload.source === 'default' && redis) {
      const staleCached =
        await redis.get<TrendingSuggestionsPayload>(STALE_CACHE_KEY)
      if (staleCached) {
        responsePayload = buildResponsePayload(
          staleCached,
          staleCached.source,
          'stale-cache'
        )
        serveMode = 'stale-cache'
        responseSource = staleCached.source
        noStore = false
      }
    }

    // Cache the result and release the lock
    if (redis) {
      if (!noStore) {
        const cacheValue =
          serveMode === 'stale-cache'
            ? {
                suggestions: responsePayload.suggestions,
                source: responseSource,
                meta: {
                  generatedAt: responsePayload.meta.generatedAt,
                  isFallback: responsePayload.meta.isFallback,
                  failureReason: responsePayload.meta.failureReason
                }
              }
            : generatedPayload

        await redis.set(CACHE_KEY, cacheValue, {
          ex: CACHE_TTL
        })
      }

      if (generatedPayload.source !== 'default') {
        await redis.set(STALE_CACHE_KEY, generatedPayload, {
          ex: STALE_CACHE_TTL
        })
      }

      if (lockAcquired) {
        await redis.del(LOCK_KEY)
      }

      if (generatedPayload.source === 'default') {
        console.info('[Suggestions] Served fallback/default source.', {
          serveMode,
          cacheTtl: noStore ? null : CACHE_TTL
        })
      }

      return toSuggestionsResponse(
        responsePayload,
        responseSource,
        serveMode,
        noStore ? undefined : CACHE_TTL,
        { noStore }
      )
    }

    return toSuggestionsResponse(
      responsePayload,
      responseSource,
      serveMode,
      noStore ? undefined : CACHE_TTL,
      { noStore }
    )
  } catch (error) {
    console.error('Suggestions API error:', error)
    const fallbackPayload = buildResponsePayload(
      {
        suggestions: DEFAULT_SUGGESTIONS,
        source: 'default',
        meta: {
          generatedAt: null,
          isFallback: true,
          failureReason: 'search-provider-failed'
        }
      },
      'default',
      'fresh-generated'
    )

    return toSuggestionsResponse(
      fallbackPayload,
      'default',
      'fresh-generated',
      undefined,
      { noStore: true }
    )
  } finally {
    await flushTraces()
  }
}
