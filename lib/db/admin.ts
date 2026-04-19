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

export function getPrivilegedDb() {
  if (_privilegedDb) {
    return _privilegedDb
  }

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

  _privilegedDb = drizzle(client, {
    schema: { ...schema, ...relations }
  })

  return _privilegedDb
}
