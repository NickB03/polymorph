import type { ModelMessage } from 'ai'

import {
  storagePathFromLegacyPublicUrl,
  storagePathFromProxyUrl
} from '@/lib/supabase/file-url'
import { downloadStorageFile } from '@/lib/supabase/server-storage'

// Walk model messages and convert file parts with URL data to inline
// Uint8Array data. The Vercel AI Gateway claims it supports all URLs, so the
// AI SDK skips its download step. But Google Gemini cannot fetch Supabase
// Storage URLs, producing URL_ERROR. We fetch server-side and inline instead.
// Data URLs (data:...) and Uint8Array content pass through unchanged.
//
// Uploads live in a private bucket and are persisted as /api/files/<path>
// proxy URLs (older messages carry absolute public storage URLs). Both are
// resolved via a direct storage download rather than HTTP, since the proxy
// route requires the requester's auth cookies.

type FileSource = { kind: 'url'; url: URL } | { kind: 'storage'; path: string }

function resolveFileSource(data: unknown): FileSource | null {
  const href =
    data instanceof URL ? data.href : typeof data === 'string' ? data : null
  if (!href) return null

  const proxyPath = storagePathFromProxyUrl(href)
  if (proxyPath) return { kind: 'storage', path: proxyPath }

  const legacyPath = storagePathFromLegacyPublicUrl(href)
  if (legacyPath) return { kind: 'storage', path: legacyPath }

  if (/^https?:\/\//i.test(href)) {
    try {
      return { kind: 'url', url: new URL(href) }
    } catch {
      return null
    }
  }
  return null
}

export async function inlineFileUrls(
  messages: ModelMessage[]
): Promise<ModelMessage[]> {
  // Collect all (messageIndex, partIndex, source) tuples that need fetching
  const downloads: {
    msgIdx: number
    partIdx: number
    source: FileSource
  }[] = []

  for (let m = 0; m < messages.length; m++) {
    const msg = messages[m]
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue

    for (let p = 0; p < msg.content.length; p++) {
      const part = msg.content[p]
      if ((part.type === 'file' || part.type === 'image') && 'data' in part) {
        const source = resolveFileSource(part.data)
        if (source) {
          downloads.push({ msgIdx: m, partIdx: p, source })
        }
      }
    }
  }

  if (downloads.length === 0) return messages

  // Fetch all sources in parallel
  const results = await Promise.all(
    downloads.map(async ({ source }) => {
      if (source.kind === 'storage') {
        return downloadStorageFile(source.path)
      }
      try {
        const res = await fetch(source.url)
        if (!res.ok) {
          console.warn(
            `[inlineFileUrls] Failed to fetch ${source.url}: ${res.status} ${res.statusText}`
          )
          return null
        }
        const buffer = await res.arrayBuffer()
        const mediaType = res.headers.get('content-type') ?? undefined
        return { data: new Uint8Array(buffer), mediaType }
      } catch (err) {
        console.warn(`[inlineFileUrls] Fetch error for ${source.url}:`, err)
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
