export function getSafeRedirectPath(next: string | null | undefined) {
  const trimmed = next?.trim()

  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/'
  }

  return trimmed
}
