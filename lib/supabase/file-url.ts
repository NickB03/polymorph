// Client-safe helpers shared by the upload path, the /api/files proxy route,
// rendering, and model-message preparation. Must not import server-only code.

export const FILE_PROXY_PREFIX = '/api/files/'

// Bucket name is duplicated from lib/supabase/storage.ts because that module
// is server-only and these helpers run in client components.
const PUBLIC_BUCKET_PATH = '/storage/v1/object/public/user-uploads/'

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/

/**
 * Uploads are written as `<userId>/chats/<chatId>/<filename>` with sanitized
 * segments. Anything else (traversal, empty segments, other shapes) is
 * rejected before touching storage.
 */
export function isSafeStoragePath(path: string): boolean {
  const segments = path.split('/')
  return (
    segments.length >= 4 &&
    segments[1] === 'chats' &&
    segments.every(
      segment =>
        SAFE_SEGMENT.test(segment) && segment !== '..' && segment !== '.'
    )
  )
}

/**
 * Extract the storage path from a proxy URL (`/api/files/<path>`, relative or
 * absolute). Returns null when the URL is not a safe proxy URL.
 */
export function storagePathFromProxyUrl(url: string): string | null {
  let pathname = url
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname
    } catch {
      return null
    }
  }
  if (!pathname.startsWith(FILE_PROXY_PREFIX)) return null
  let path: string
  try {
    path = decodeURIComponent(pathname.slice(FILE_PROXY_PREFIX.length))
  } catch {
    return null
  }
  return isSafeStoragePath(path) ? path : null
}

/**
 * Extract the storage path from a legacy public-object URL persisted in old
 * messages, but only when it points at the configured Supabase host.
 */
export function storagePathFromLegacyPublicUrl(url: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null
  try {
    const parsed = new URL(url)
    if (parsed.host !== new URL(supabaseUrl).host) return null
    if (!parsed.pathname.startsWith(PUBLIC_BUCKET_PATH)) return null
    const path = decodeURIComponent(
      parsed.pathname.slice(PUBLIC_BUCKET_PATH.length)
    )
    return isSafeStoragePath(path) ? path : null
  } catch {
    return null
  }
}

/**
 * Rewrite a legacy public storage URL to the auth-checked proxy route. Any
 * other URL passes through unchanged.
 */
export function toProxyFileUrl(url: string): string {
  const legacyPath = storagePathFromLegacyPublicUrl(url)
  return legacyPath ? `${FILE_PROXY_PREFIX}${legacyPath}` : url
}
