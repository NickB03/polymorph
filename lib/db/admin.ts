import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import 'server-only'

import * as relations from './relations'
import * as schema from './schema'

const sslConfig =
  process.env.DATABASE_SSL_DISABLED === 'true'
    ? false
    : { rejectUnauthorized: false }

let _privilegedDb: ReturnType<typeof drizzle> | null = null
let _privilegedDbPromise: Promise<ReturnType<typeof drizzle>> | null = null

function assertPrivilegedRole(currentUser: string | undefined) {
  if (currentUser?.includes('app_user')) {
    throw new Error(
      `Privileged database writes require owner credentials, but DATABASE_URL resolved to restricted role "${currentUser}"`
    )
  }
}

export async function getPrivilegedDb() {
  if (_privilegedDb) {
    return _privilegedDb
  }

  if (_privilegedDbPromise) {
    return _privilegedDbPromise
  }

  // This helper must bypass RLS. Never fall back to DATABASE_RESTRICTED_URL.
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    'postgres://placeholder:placeholder@localhost:5432/placeholder'

  if (
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_URL &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'DATABASE_URL or POSTGRES_URL is required for privileged database writes'
    )
  }

  const client = postgres(connectionString, {
    ssl: sslConfig,
    prepare: false,
    max: 5
  })

  const privilegedDb = drizzle(client, {
    schema: { ...schema, ...relations }
  })

  _privilegedDbPromise = (async () => {
    try {
      const result = await privilegedDb.execute<{ current_user: string }>(
        sql`SELECT current_user`
      )
      assertPrivilegedRole(result[0]?.current_user)
      _privilegedDb = privilegedDb
      return privilegedDb
    } catch (error) {
      _privilegedDbPromise = null
      throw error
    }
  })()

  return _privilegedDbPromise
}
