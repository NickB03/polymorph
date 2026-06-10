import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { getChatsPage } from '@/lib/actions/chat'
import { Chat as DBChat } from '@/lib/db/schema'

interface ChatPageResponse {
  chats: DBChat[]
  nextOffset: number | null
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const offset = clampInt(
    searchParams.get('offset'),
    0,
    0,
    Number.MAX_SAFE_INTEGER
  )
  const limit = clampInt(searchParams.get('limit'), 20, 1, 100)

  try {
    const result = await getChatsPage(limit, offset)
    return NextResponse.json<ChatPageResponse>(result)
  } catch (error) {
    console.error('API route error fetching chats:', error)
    return NextResponse.json<ChatPageResponse>(
      { chats: [], nextOffset: null },
      { status: 500 }
    )
  }
}
