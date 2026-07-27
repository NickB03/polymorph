import { NextRequest, NextResponse } from 'next/server'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

type TracingState =
  | 'enabled'
  | 'disabled-off'
  | 'disabled-https'
  | 'init-failed'

declare global {
  var __polymorphTracingState: TracingState | undefined
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString()
  const checks = req.nextUrl.searchParams.get('check')

  // Always check database
  let dbStatus: 'connected' | 'error' = 'error'
  let dbError: string | undefined
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Database health check timed out after 5s')),
          5000
        )
      )
    ])
    dbStatus = 'connected'
  } catch (error) {
    dbError =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : 'Unknown error'
        : 'unreachable'
  }

  // Optional Phoenix check (only when requested and tracing is configured).
  // Phoenix status is advisory-only — it does NOT affect the HTTP status code.
  // Load balancers hit /api/health without params and only care about DB status.
  let phoenixStatus: 'ok' | 'error' | 'disabled' | undefined
  if (checks === 'phoenix' || checks === 'all') {
    const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT
    if (!endpoint || process.env.ENABLE_TRACING !== 'true') {
      phoenixStatus = 'disabled'
    } else {
      try {
        // Phoenix exposes a health endpoint at /healthz.
        // If your Phoenix version uses a different path, update this.
        const resp = await fetch(`${endpoint}/healthz`, {
          signal: AbortSignal.timeout(3000)
        })
        phoenixStatus = resp.ok ? 'ok' : 'error'
      } catch {
        phoenixStatus = 'error'
      }
    }
  }

  const isHealthy = dbStatus === 'connected'
  const body: Record<string, unknown> = {
    status: isHealthy ? 'ok' : 'error',
    timestamp,
    db: dbStatus
  }
  if (dbError) body.dbError = dbError
  if (phoenixStatus !== undefined) body.phoenix = phoenixStatus
  // `phoenix: 'ok'` only means the collector is reachable. `tracing` says
  // whether THIS process registered an exporter — the blind-deploy signature
  // is phoenix: 'ok' with tracing: 'disabled-https'.
  if (checks === 'phoenix' || checks === 'all') {
    body.tracing = globalThis.__polymorphTracingState ?? 'unknown'
  }

  return NextResponse.json(body, { status: isHealthy ? 200 : 503 })
}
