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
