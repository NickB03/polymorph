import { NextResponse } from 'next/server'

import { eq } from 'drizzle-orm'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { chats } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'
import { isSafeStoragePath } from '@/lib/supabase/file-url'
import { createSignedDownloadUrl } from '@/lib/supabase/server-storage'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 300

/**
 * Auth-checked serving path for the private user-uploads bucket. Persisted
 * attachment URLs point here (stable forever); access is validated on every
 * request, then redirected to a short-lived signed URL.
 *
 * Access rule: the path owner may always read; anyone may read attachments
 * of a chat that is public and owned by the path owner.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  const storagePath = segments.join('/')
  if (!isSafeStoragePath(storagePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [ownerId, , chatId] = segments
  const userId = await getCurrentUserId()

  let allowed = Boolean(userId) && userId === ownerId
  if (!allowed) {
    // No RLS GUC is set in this query, so only the `public_chats_readable`
    // policy applies: the row comes back iff the chat is public.
    const rows = await withOptionalRLS(null, async tx =>
      tx
        .select({ userId: chats.userId, visibility: chats.visibility })
        .from(chats)
        .where(eq(chats.id, chatId))
        .limit(1)
    )
    const chat = rows[0]
    allowed = chat?.visibility === 'public' && chat.userId === ownerId
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const signedUrl = await createSignedDownloadUrl(
    storagePath,
    SIGNED_URL_TTL_SECONDS
  )
  if (!signedUrl) {
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 })
  }

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { 'Cache-Control': 'private, max-age=60' }
  })
}
