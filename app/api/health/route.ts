import { NextResponse } from 'next/server'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    // 5-second timeout for DB check
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Database health check timed out after 5s')),
          5000
        )
      )
    ])

    return NextResponse.json(
      { status: 'ok', timestamp, db: 'connected' },
      { status: 200 }
    )
  } catch (error) {
    const dbError =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : 'Unknown error'
        : 'unreachable'

    return NextResponse.json(
      { status: 'error', timestamp, db: 'error', dbError },
      { status: 503 }
    )
  }
}
