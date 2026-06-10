import { getErrorMessage } from '@/lib/utils/error'

import { FILE_PROXY_PREFIX } from './file-url'
import { createClient } from './server'

export const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'user-uploads'

export async function uploadFileToSupabase(
  file: File,
  userId: string,
  chatId: string
) {
  const supabase = await createClient()
  const sanitizedFileName = file.name
    .replace(/[^a-z0-9.\-_]/gi, '_')
    .toLowerCase()
  const filePath = `${userId}/chats/${chatId}/${Date.now()}-${sanitizedFileName}`

  try {
    const buffer = await file.arrayBuffer()

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      throw error
    }

    // The bucket is private; files are served through the auth-checked
    // proxy route, which keeps persisted message URLs stable forever.
    return {
      filename: file.name,
      url: `${FILE_PROXY_PREFIX}${filePath}`,
      mediaType: file.type,
      type: 'file'
    }
  } catch (error: unknown) {
    console.error('Supabase Upload Error:', error)
    const message = getErrorMessage(error)
    throw new Error('Upload failed: ' + message)
  }
}
