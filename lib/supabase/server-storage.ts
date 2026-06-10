import { createClient } from '@supabase/supabase-js'

import { SUPABASE_STORAGE_BUCKET } from './storage'

let _adminClient: ReturnType<typeof createClient> | null = null

function getAdminClient() {
  if (_adminClient) return _adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server-side storage uploads'
    )
  }
  _adminClient = createClient(url, key)
  return _adminClient
}

export function buildGeneratedImagePath(
  userId: string,
  chatId: string,
  mediaType: string
): string {
  const ext = mediaType.split('/')[1] || 'png'
  return `${userId}/chats/${chatId}/generated-${Date.now()}.${ext}`
}

export async function uploadGeneratedImage(
  imageData: Uint8Array,
  mediaType: string,
  userId: string,
  chatId: string
): Promise<{ url: string; filename: string }> {
  const admin = getAdminClient()
  const filePath = buildGeneratedImagePath(userId, chatId, mediaType)

  const { error } = await admin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(filePath, imageData, {
      contentType: mediaType,
      upsert: false
    })

  if (error) {
    console.error('[uploadGeneratedImage] Storage upload failed:', error)
    throw new Error('Image upload failed: ' + error.message)
  }

  const {
    data: { publicUrl }
  } = admin.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(filePath)

  const filename = filePath.split('/').pop() ?? 'generated.png'
  return { url: publicUrl, filename }
}

/**
 * Create a short-lived signed URL for a file in the private uploads bucket.
 * Authorization happens in the /api/files route before this is called.
 */
export async function createSignedDownloadUrl(
  path: string,
  expiresInSeconds: number
): Promise<string | null> {
  const admin = getAdminClient()
  const { data, error } = await admin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error('[createSignedDownloadUrl] Failed:', error)
    return null
  }
  return data.signedUrl
}

/**
 * Download a file from the private uploads bucket. Used when preparing model
 * messages, where attachment URLs point at the auth-checked proxy route and
 * cannot be fetched over plain HTTP.
 */
export async function downloadStorageFile(
  path: string
): Promise<{ data: Uint8Array; mediaType?: string } | null> {
  const admin = getAdminClient()
  const { data, error } = await admin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .download(path)

  if (error || !data) {
    console.warn('[downloadStorageFile] Failed:', error)
    return null
  }
  return {
    data: new Uint8Array(await data.arrayBuffer()),
    mediaType: data.type || undefined
  }
}
