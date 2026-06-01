// @vitest-environment node
//
// REAL-Postgres RLS integration test. Unlike rls-policies.integration.test.ts
// (which mocks the DB), this connects to a live Postgres as the restricted
// `app_user` role so Row-Level Security is actually enforced.
//
// It is OPT-IN: it self-skips unless RUN_DB_INTEGRATION=true is set, so the
// default `bun run test` (which has only a dummy DATABASE_URL) never tries to
// connect. CI provides a postgres:17 service, runs `bun run migrate` as the
// owner, creates the restricted role, and sets:
//   DATABASE_URL             -> owner (seeding, bypasses RLS)
//   DATABASE_RESTRICTED_URL  -> app_user (RLS active; used by the app `db`)
//   RUN_DB_INTEGRATION=true
import { eq, sql } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { createChat } from '@/lib/db/actions'
import { chats } from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'

const RUN = process.env.RUN_DB_INTEGRATION === 'true'

describe.skipIf(!RUN)('RLS policies (real Postgres)', () => {
  let owner: ReturnType<typeof postgres>
  const seededIds: string[] = []
  const prefix = `rls-it-${Date.now()}`

  beforeAll(async () => {
    owner = postgres(process.env.DATABASE_URL as string, {
      ssl: false,
      prepare: false
    })
  })

  afterAll(async () => {
    if (seededIds.length > 0) {
      await owner`delete from chats where id in ${owner(seededIds)}`
    }
    await owner.end({ timeout: 5 })
  })

  it('connects to the app database as the restricted app_user (RLS not bypassed)', async () => {
    const rows = await db.execute<{ current_user: string }>(
      sql`select current_user`
    )
    // Guard: if this is the owner/superuser, the zero-rows assertion below
    // would pass for the wrong reason.
    expect(String(rows[0]?.current_user)).toContain('app_user')
  })

  it('returns zero rows when the app.current_user_id GUC is unset', async () => {
    // Seed a private chat as the owner (bypasses RLS).
    const id = `${prefix}-unset`
    seededIds.push(id)
    await owner`
      insert into chats (id, user_id, title, visibility)
      values (${id}, ${'someone-else'}, ${'Someone elses chat'}, 'private')
    `

    // The app db connects as app_user with no GUC set -> the policy
    // user_id = current_setting('app.current_user_id', true) evaluates against
    // NULL, so nothing matches.
    const visible = await db.select().from(chats).where(eq(chats.id, id))
    expect(visible).toHaveLength(0)
  })

  it('scopes reads to the user set via withRLS', async () => {
    const idA = `${prefix}-a`
    seededIds.push(idA)
    await createChat({ id: idA, userId: 'user-A', title: 'A private chat' })

    const asA = await withRLS('user-A', tx =>
      tx.select().from(chats).where(eq(chats.id, idA))
    )
    expect(asA).toHaveLength(1)

    const asB = await withRLS('user-B', tx =>
      tx.select().from(chats).where(eq(chats.id, idA))
    )
    expect(asB).toHaveLength(0)
  })
})
