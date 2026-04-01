import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { config } from './config'

const client = postgres(config.databaseUrl, {
  ssl: config.databaseSslDisabled ? false : { rejectUnauthorized: false },
  prepare: false,
  max: 5
})

export const db = drizzle(client)

export async function closeDb() {
  await client.end()
}
