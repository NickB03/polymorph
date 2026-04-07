import type { ModelMessage } from 'ai'

// Walk model messages and convert file parts with HTTPS URLs to inline
// Uint8Array data. The Vercel AI Gateway claims it supports all URLs, so the
// AI SDK skips its download step. But Google Gemini cannot fetch Supabase
// Storage URLs, producing URL_ERROR. We fetch server-side and inline instead.
// Data URLs (data:...) and Uint8Array content pass through unchanged.
export async function inlineFileUrls(
  messages: ModelMessage[]
): Promise<ModelMessage[]> {
  // Collect all (messageIndex, partIndex, url) tuples that need fetching
  const downloads: {
    msgIdx: number
    partIdx: number
    url: URL
  }[] = []

  for (let m = 0; m < messages.length; m++) {
    const msg = messages[m]
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue

    for (let p = 0; p < msg.content.length; p++) {
      const part = msg.content[p]
      if ((part.type === 'file' || part.type === 'image') && 'data' in part) {
        // After convertToModelMessages(), data is a string (the URL).
        // After convertToLanguageModelPrompt(), it would be a URL instance.
        // We handle both cases.
        const data = part.data
        if (data instanceof URL) {
          downloads.push({ msgIdx: m, partIdx: p, url: data })
        } else if (typeof data === 'string' && data.startsWith('http')) {
          try {
            downloads.push({ msgIdx: m, partIdx: p, url: new URL(data) })
          } catch {
            // Not a valid URL — skip
          }
        }
      }
    }
  }

  if (downloads.length === 0) return messages

  // Fetch all URLs in parallel
  const results = await Promise.all(
    downloads.map(async ({ url }) => {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          console.warn(
            `[inlineFileUrls] Failed to fetch ${url}: ${res.status} ${res.statusText}`
          )
          return null
        }
        const buffer = await res.arrayBuffer()
        const mediaType = res.headers.get('content-type') ?? undefined
        return { data: new Uint8Array(buffer), mediaType }
      } catch (err) {
        console.warn(`[inlineFileUrls] Fetch error for ${url}:`, err)
        return null
      }
    })
  )

  // Clone messages and replace URL data with fetched binary data
  const cloned = messages.map(msg => ({
    ...msg,
    ...(Array.isArray(msg.content)
      ? { content: msg.content.map(part => ({ ...part })) }
      : {})
  })) as ModelMessage[]

  for (let i = 0; i < downloads.length; i++) {
    const result = results[i]
    if (!result) continue

    const { msgIdx, partIdx } = downloads[i]
    const msg = cloned[msgIdx]
    if (!Array.isArray(msg.content)) continue

    const part = msg.content[partIdx] as Record<string, unknown>
    part.data = result.data
    if (result.mediaType) {
      part.mediaType = result.mediaType
    }
  }

  return cloned
}
