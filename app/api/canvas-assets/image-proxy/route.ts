import { isIP } from 'node:net'

import { checkAndEnforceCanvasLimit } from '@/lib/rate-limit/canvas-limits'
import { createSearchProvider } from '@/lib/tools/search/providers'
import { isCloudDeployment } from '@/lib/utils'
import { jsonError } from '@/lib/utils/json-error'

export const dynamic = 'force-dynamic'

const MAX_QUERY_LENGTH = 200
const CACHE_CONTROL = 'private, max-age=3600, stale-while-revalidate=86400'

function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase()
}

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

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(part => Number(part))
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part))) {
    return false
  }

  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 100 && b >= 64 && b <= 127) return true

  return false
}

function decodeMappedIpv4(hostname: string): string | null {
  if (!hostname.startsWith('::ffff:')) {
    return null
  }

  const mapped = hostname.slice('::ffff:'.length)
  if (isIP(mapped) === 4) {
    return mapped
  }

  const groups = mapped.split(':')
  if (groups.length !== 2) {
    return null
  }

  const values = groups.map(group => Number.parseInt(group, 16))
  if (
    values.some(value => Number.isNaN(value) || value < 0 || value > 0xffff)
  ) {
    return null
  }

  const [high, low] = values

  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(
    '.'
  )
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = normalizeHost(hostname)
  const mappedIpv4 = decodeMappedIpv4(normalized)
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4)
  }

  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

function isSafeRedirectTarget(candidate: string): boolean {
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return false
  }

  if (url.protocol !== 'https:') {
    return false
  }

  const hostname = normalizeHost(url.hostname)
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return false
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    return !isPrivateIpv4(hostname)
  }
  if (ipVersion === 6) {
    return !isPrivateIpv6(hostname)
  }

  return true
}

function getFirstThumbnailUrl(images: unknown): string | null {
  if (!Array.isArray(images)) {
    return null
  }

  const firstImage = images[0]
  if (
    firstImage &&
    typeof firstImage === 'object' &&
    'thumbnailUrl' in firstImage &&
    typeof firstImage.thumbnailUrl === 'string'
  ) {
    return firstImage.thumbnailUrl.trim()
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
