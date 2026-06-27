// Backslashes and C0 control characters (incl. tab/newline/CR) are treated by
// the WHATWG URL parser as path separators or stripped entirely, so a value
// like '/\evil.com', '/\/evil.com', or '/<tab>/evil.com' collapses to
// '//evil.com' — an authority — and resolves cross-origin. Reject them so a
// "relative" redirect target can never smuggle an external host.
const UNSAFE_REDIRECT_CHARS = /[\\\x00-\x1f]/

export function getSafeRedirectPath(next: string | null | undefined) {
  const trimmed = next?.trim()

  if (
    !trimmed ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    UNSAFE_REDIRECT_CHARS.test(trimmed)
  ) {
    return '/'
  }

  return trimmed
}
