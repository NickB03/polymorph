import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { config } from './config'

const client = postgres(config.databaseUrl, {
  // rejectUnauthorized: false is needed because Supabase's connection pooler
  // terminates TLS with certificates not present in the container's trust store.
  // Traffic is still encrypted in transit via the pooler's TLS.
  ssl: config.databaseSslDisabled ? false : { rejectUnauthorized: false },
  prepare: false,
  max: config.dbPoolMax
})

export const db = drizzle(client)

export async function closeDb() {
  await client.end()
}
