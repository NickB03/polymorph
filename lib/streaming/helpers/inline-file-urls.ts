import { readResponseWithSizeLimit } from '@ai-sdk/provider-utils'
import type { ModelMessage } from 'ai'

import {
  storagePathFromLegacyPublicUrl,
  storagePathFromProxyUrl
} from '@/lib/supabase/file-url'
import { downloadStorageFile } from '@/lib/supabase/server-storage'
import { MAX_UPLOAD_SIZE_BYTES } from '@/lib/utils/file-validation'
import { isSafeRedirectTarget } from '@/lib/utils/safe-url'

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

const FETCH_TIMEOUT_MS = 10_000

type FileSource = { kind: 'url'; url: URL } | { kind: 'storage'; path: string }

function resolveFileSource(
  data: unknown,
  userId: string | null
): FileSource | null {
  const href =
    data instanceof URL ? data.href : typeof data === 'string' ? data : null
  if (!href) return null

  const storagePath =
    storagePathFromProxyUrl(href) ?? storagePathFromLegacyPublicUrl(href)
  if (storagePath) {
    // The service-role download bypasses storage RLS, so only the requesting
    // user's own files may be inlined here — file parts arrive from the
    // client unvalidated, and a forged path must not leak another user's
    // private uploads. Foreign or anonymous paths are left as URL strings
    // (authorization for browser reads lives in the /api/files route).
    if (userId && storagePath.startsWith(`${userId}/`)) {
      return { kind: 'storage', path: storagePath }
    }
    return null
  }

  // File parts arrive from the client unvalidated, so this fetch is an SSRF
  // sink: only https URLs that do not resolve to localhost or a private range
  // may be fetched server-side.
  if (/^https?:\/\//i.test(href) && isSafeRedirectTarget(href)) {
    try {
      return { kind: 'url', url: new URL(href) }
    } catch {
      return null
    }
  }
  return null
}

export async function inlineFileUrls(
  messages: ModelMessage[],
  userId: string | null
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
        const source = resolveFileSource(part.data, userId)
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
        const res = await fetch(source.url, {
          redirect: 'error',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        })
        if (!res.ok) {
          console.warn(
            `[inlineFileUrls] Failed to fetch ${source.url}: ${res.status} ${res.statusText}`
          )
          return null
        }
        const declaredLength = Number(res.headers.get('content-length'))
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > MAX_UPLOAD_SIZE_BYTES
        ) {
          console.warn(
            `[inlineFileUrls] Refusing oversized file from ${source.url}: ${declaredLength} bytes`
          )
          return null
        }
        // Streams the body and throws once it passes the cap, so a lying or
        // absent content-length cannot make us buffer an unbounded response.
        const data = await readResponseWithSizeLimit({
          response: res,
          url: source.url.href,
          maxBytes: MAX_UPLOAD_SIZE_BYTES
        })
        const mediaType = res.headers.get('content-type') ?? undefined
        return { data, mediaType }
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
