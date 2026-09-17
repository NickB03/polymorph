import { isIP } from 'node:net'

import { checkAndEnforceCanvasLimit } from '@/lib/rate-limit/canvas-limits'
import { createSearchProvider } from '@/lib/tools/search/providers'
import { isCloudDeployment } from '@/lib/utils'
import { jsonError } from '@/lib/utils/json-error'
import { isSafeRedirectTarget } from '@/lib/utils/safe-url'

export const dynamic = 'force-dynamic'

const MAX_QUERY_LENGTH = 200
const CACHE_CONTROL = 'private, max-age=3600, stale-while-revalidate=86400'

function getTrustedIpCandidate(value: string | null): string | null {
  const candidate = value?.split(',')[0]?.trim()
  if (!candidate) {
    return null
  }

  return isIP(candidate) ? candidate : null
}

function getClientIp(request: Request): string {
  if (!isCloudDeployment()) {
    return 'local-dev'
  }

  return (
    getTrustedIpCandidate(request.headers.get('x-forwarded-for')) ||
    getTrustedIpCandidate(request.headers.get('x-real-ip')) ||
    'local-dev'
  )
}

function getFirstThumbnailUrl(images: unknown): string | null {
  if (!Array.isArray(images)) {
    return null
  }

  // SearchResultImage is `string | { url, description }`. The provider's
  // image entries carry the (thumbnail) image URL in `url`.
  const firstImage = images[0]
  if (typeof firstImage === 'string') {
    return firstImage.trim() || null
  }
  if (
    firstImage &&
    typeof firstImage === 'object' &&
    'url' in firstImage &&
    typeof firstImage.url === 'string'
  ) {
    return firstImage.url.trim() || null
  }

  return null
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')
  const trimmedQuery = query?.trim() ?? ''

  if (!query) {
    return jsonError('BAD_REQUEST', 'q is required', 400)
  }

  if (!trimmedQuery) {
    return jsonError('BAD_REQUEST', 'q cannot be blank', 400)
  }

  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    return jsonError('BAD_REQUEST', 'q is too long', 400)
  }

  const limitResponse = await checkAndEnforceCanvasLimit(
    getClientIp(request),
    'image-proxy'
  )
  if (limitResponse) return limitResponse

  try {
    const provider = createSearchProvider('brave')
    const results = await provider.search(trimmedQuery, 10, 'basic', [], [], {
      type: 'general',
      content_types: ['image']
    })

    const thumbnailUrl = getFirstThumbnailUrl(results.images)
    if (!thumbnailUrl || !isSafeRedirectTarget(thumbnailUrl)) {
      return jsonError('NOT_FOUND', 'No safe image thumbnail found', 404)
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: thumbnailUrl,
        'Cache-Control': CACHE_CONTROL
      }
    })
  } catch (error) {
    console.error('Canvas image proxy error:', error)
    return jsonError('BAD_GATEWAY', 'Unable to fetch image thumbnail', 502)
  }
}
