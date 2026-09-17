import { isIP } from 'node:net'

// SSRF guards shared by every server-side fetch of a URL that originated
// outside our trust boundary (search-provider thumbnails, client-supplied
// file parts). Hostname-based only: it rejects literal private addresses and
// localhost, but cannot stop a public hostname that resolves to a private IP.

function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase()
}

export function isPrivateIpv4(hostname: string): boolean {
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

export function isPrivateIpv6(hostname: string): boolean {
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

/**
 * True when `candidate` is an https URL that does not point at localhost or a
 * private/link-local address.
 */
export function isSafeRedirectTarget(candidate: string): boolean {
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
