import { NextResponse } from 'next/server'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    // 5-second timeout for DB check
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      await Promise.race([
        db.execute(sql`SELECT 1`),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new Error('Database health check timed out after 5s'))
          )
        })
      ])
    } finally {
      clearTimeout(timeout)
    }

    return NextResponse.json(
      { status: 'ok', timestamp, db: 'connected' },
      { status: 200 }
    )
  } catch (error) {
    const dbError = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { status: 'error', timestamp, db: 'error', dbError },
      { status: 503 }
    )
  }
}
