import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkPerMinuteLimit } from '@/lib/rate-limit/per-minute-limiter'
import {
  advancedSearchSchema,
  runAdvancedSearch
} from '@/lib/tools/search/advanced-search'
import { jsonError } from '@/lib/utils/json-error'

const ADVANCED_SEARCH_LIMIT_PER_MINUTE = 10

export async function POST(request: Request) {
  // Same identity rule as /api/chat: signed-in users always, guests only when
  // guest chat is enabled. Each search can fan out into outbound crawls, so it
  // is rate limited per user (or per IP for guests).
  const userId = await getCurrentUserId()
  if (!userId && process.env.ENABLE_GUEST_CHAT !== 'true') {
    return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
  }

  // X-Forwarded-For is trusted for the same reason as in /api/chat: Vercel's
  // edge overwrites it.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const limit = await checkPerMinuteLimit(
    'advanced-search',
    userId ?? `guest:${ip}`,
    ADVANCED_SEARCH_LIMIT_PER_MINUTE
  )
  if (!limit.allowed) {
    return jsonError('RATE_LIMITED', 'Too many search requests', 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid JSON body',
        results: [],
        images: [],
        number_of_results: 0
      },
      { status: 400 }
    )
  }

  const parseResult = advancedSearchSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: parseResult.error.issues
          .map(issue =>
            issue.path.length
              ? `${issue.path.join('.')}: ${issue.message}`
              : issue.message
          )
          .join(', '),
        results: [],
        images: [],
        number_of_results: 0
      },
      { status: 400 }
    )
  }

  try {
    const results = await runAdvancedSearch(parseResult.data)
    return NextResponse.json(results)
  } catch (error) {
    // Keep the detailed error server-side only; returning it to the client
    // would leak backend internals (e.g. SearXNG status payloads, config state).
    console.error('Advanced search error:', error)
    return NextResponse.json(
      {
        message: 'Internal Server Error',
        error: 'Search failed',
        query: parseResult.data.query,
        results: [],
        images: [],
        number_of_results: 0
      },
      { status: 500 }
    )
  }
}
