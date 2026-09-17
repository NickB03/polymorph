import { isIP } from 'node:net'

// SSRF guards shared by every server-side fetch of a URL that originated
// outside our trust boundary (search-provider thumbnails, client-supplied
// file parts). Hostname-based only: it rejects literal private addresses and
// localhost, but cannot stop a public hostname that resolves to a private IP.

function normalizeHost(hostname: string): string {
  return hostname
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '')
    .toLowerCase()
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

// IPv6 ranges that carry an IPv4 address in their low 32 bits: IPv4-mapped,
// NAT64 and the deprecated IPv4-compatible ::/96. WHATWG URL serializes these
// in hex (https://[::127.0.0.1]/ -> ::7f00:1), so decode rather than string-match.
const EMBEDDED_IPV4_PREFIXES = ['::ffff:', '64:ff9b::', '::']

function decodeEmbeddedIpv4(hostname: string): string | null {
  const prefix = EMBEDDED_IPV4_PREFIXES.find(p => hostname.startsWith(p))
  if (!prefix) {
    return null
  }

  const mapped = hostname.slice(prefix.length)
  if (isIP(mapped) === 4) {
    return mapped
  }

  const groups = mapped.split(':')
  if (groups.length > 2) {
    return null
  }
  // Zero compression can swallow the high group (64:ff9b::5 is 0.0.0.5).
  if (groups.length === 1) {
    groups.unshift('0')
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
  if (normalized === '::') {
    return true
  }

  // Also covers ::1, which decodes to 0.0.0.1
  const embeddedIpv4 = decodeEmbeddedIpv4(normalized)
  if (embeddedIpv4) {
    return isPrivateIpv4(embeddedIpv4)
  }

  return (
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    // fe80::/10 spans fe80 through febf
    /^fe[89ab]/.test(normalized)
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
