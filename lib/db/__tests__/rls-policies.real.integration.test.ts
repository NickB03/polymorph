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

import { updateMessageFeedback } from '@/lib/actions/feedback'
import { GUEST_USER_ID } from '@/lib/canvas/constants'
import { db } from '@/lib/db'
import {
  createCanvasArtifact,
  createChat,
  ensureChatRecord,
  loadCanvasArtifactById,
  loadChatWithMessages,
  updateChatTitle,
  upsertMessage
} from '@/lib/db/actions'
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

  // The guest canvas path must work under the restricted role, not only when
  // the app's role bypasses RLS: guests run under the shared guest identity.
  describe('guest canvas path', () => {
    const draftSource = { 'App.tsx': 'export default () => null' }

    it('creates and loads a guest artifact under the guest identity only', async () => {
      const chatId = `${prefix}-guest`
      const artifactId = `${prefix}-guest-art`
      seededIds.push(chatId) // the artifact cascades with the chat

      await ensureChatRecord({
        id: chatId,
        title: 'Guest canvas',
        userId: GUEST_USER_ID
      })
      await createCanvasArtifact({
        id: artifactId,
        chatId,
        userId: GUEST_USER_ID,
        title: 'Guest artifact',
        draftSource
      })

      await expect(
        loadCanvasArtifactById(artifactId, GUEST_USER_ID)
      ).resolves.toMatchObject({ id: artifactId, userId: GUEST_USER_ID })
      await expect(
        loadCanvasArtifactById(artifactId, 'user-A')
      ).resolves.toBeNull()
    })

    it("does not load another user's artifact, as a user or as a guest", async () => {
      const chatId = `${prefix}-art-owner`
      const artifactId = `${prefix}-art-owner-art`
      seededIds.push(chatId)
      await createChat({ id: chatId, userId: 'user-A', title: 'A canvas' })
      await createCanvasArtifact({
        id: artifactId,
        chatId,
        userId: 'user-A',
        title: 'A artifact',
        draftSource
      })

      await expect(
        loadCanvasArtifactById(artifactId, 'user-A')
      ).resolves.toMatchObject({ id: artifactId })
      await expect(
        loadCanvasArtifactById(artifactId, 'user-B')
      ).resolves.toBeNull()
      await expect(
        loadCanvasArtifactById(artifactId, GUEST_USER_ID)
      ).resolves.toBeNull()
    })

    it("refuses a guest create in another user's chat", async () => {
      const chatId = `${prefix}-guest-hijack`
      seededIds.push(chatId)
      await createChat({ id: chatId, userId: 'user-A', title: 'A chat' })

      await ensureChatRecord({
        id: chatId,
        title: 'hijack',
        userId: GUEST_USER_ID
      })
      await expect(
        createCanvasArtifact({
          chatId,
          userId: GUEST_USER_ID,
          title: 'hijack',
          draftSource
        })
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('reads with no user (no GUC)', () => {
    it('reads a public chat and its messages, but not a private one', async () => {
      const publicId = `${prefix}-public`
      const privateId = `${prefix}-private`
      seededIds.push(publicId, privateId)
      await createChat({
        id: publicId,
        userId: 'user-A',
        title: 'Shared',
        visibility: 'public'
      })
      await createChat({ id: privateId, userId: 'user-A', title: 'Private' })
      for (const chatId of [publicId, privateId]) {
        await upsertMessage(
          { id: `${chatId}-m1`, chatId, role: 'user', parts: [] },
          'user-A'
        )
      }

      const shared = await loadChatWithMessages(publicId)
      expect(shared?.messages.map(m => m.id)).toEqual([`${publicId}-m1`])
      await expect(loadChatWithMessages(privateId)).resolves.toBeNull()
    })
  })

  // Not an RLS test, but it needs real Postgres and this is the file the
  // DB-integration CI job runs: a mock cannot prove mutual exclusion.
  it('serializes a stale-guarded write behind an in-flight newer message', async () => {
    const chatId = `${prefix}-lock`
    seededIds.push(chatId) // messages cascade with the chat
    await createChat({ id: chatId, userId: 'user-A', title: 'Lock chat' })
    const answered = `${prefix}-u1`
    await upsertMessage(
      { id: answered, chatId, role: 'user', parts: [] },
      'user-A'
    )

    let releaseNewerTurn!: () => void
    const newerTurnMayCommit = new Promise<void>(r => (releaseNewerTurn = r))
    let newerTurnHoldsLock!: () => void
    const lockHeld = new Promise<void>(r => (newerTurnHoldsLock = r))

    // A newer turn that has taken the chat's lock and written its message but
    // not yet committed — the exact window the guard used to lose.
    const newerTurn = owner.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${chatId}))`
      await tx`
        insert into messages (id, chat_id, role, ui_message, created_at)
        values (${`${prefix}-u2`}, ${chatId}, 'user', '{}'::jsonb, now() + interval '1 second')
      `
      newerTurnHoldsLock()
      await newerTurnMayCommit
    })
    await lockHeld

    const latePartial = upsertMessage(
      { id: `${prefix}-partial`, chatId, role: 'assistant', parts: [] },
      'user-A',
      { latestId: answered, since: new Date() }
    )

    // Barrier, not a timer: wait until Postgres itself reports a session
    // waiting on this chat's advisory lock. Without the lock no waiter ever
    // appears (the uncommitted newer message is invisible, the guard passes,
    // the stale partial lands) and this fails — on any runner speed.
    try {
      let waiters = 0
      // ~2s budget: well inside the 5s test timeout, so a missing lock fails
      // on the assertion below rather than as an opaque timeout.
      for (let i = 0; i < 40 && waiters === 0; i++) {
        const [row] = await owner`
          select count(*)::int as n from pg_locks
          where locktype = 'advisory' and not granted
            and objid = (hashtext(${chatId})::bigint & 4294967295)::oid
        `
        waiters = row.n
        if (waiters === 0) await new Promise(r => setTimeout(r, 50))
      }
      expect(waiters).toBe(1)
    } finally {
      // Always let the held transaction finish, or a failed assertion would
      // leave it (and the lock) open until the connection is torn down.
      releaseNewerTurn()
      await newerTurn
    }

    await expect(latePartial).resolves.toBeNull()
    const rows = await owner`
      select id from messages where chat_id = ${chatId} order by created_at
    `
    expect(rows.map(r => r.id)).toEqual([answered, `${prefix}-u2`])
  })

  // Application-level ownership guards. These hold whatever role the app
  // connects as (production's role bypasses RLS), so they assert the explicit
  // errors rather than an RLS violation.
  describe('explicit ownership guards', () => {
    it("refuses to write a message or title into another user's chat", async () => {
      const chatId = `${prefix}-victim`
      seededIds.push(chatId)
      await createChat({ id: chatId, userId: 'user-A', title: 'Victim chat' })

      await expect(
        upsertMessage(
          { id: `${prefix}-injected`, chatId, role: 'user', parts: [] },
          'user-B'
        )
      ).rejects.toThrow('Unauthorized')
      await expect(
        updateChatTitle(chatId, 'pwned', 'user-B')
      ).resolves.toBeNull()

      const rows = await owner`
        select c.title, count(m.id)::int as messages
        from chats c left join messages m on m.chat_id = c.id
        where c.id = ${chatId} group by c.title
      `
      expect(rows[0]).toMatchObject({ title: 'Victim chat', messages: 0 })
    })

    it('refuses to overwrite a message id that lives in another chat', async () => {
      const victimChat = `${prefix}-ow-victim`
      const attackerChat = `${prefix}-ow-attacker`
      const messageId = `${prefix}-ow-msg`
      seededIds.push(victimChat, attackerChat)
      await createChat({ id: victimChat, userId: 'user-A', title: 'A' })
      await createChat({ id: attackerChat, userId: 'user-B', title: 'B' })
      await upsertMessage(
        {
          id: messageId,
          chatId: victimChat,
          role: 'user',
          parts: [{ type: 'text', text: 'original' }]
        },
        'user-A'
      )

      await expect(
        upsertMessage(
          {
            id: messageId,
            chatId: attackerChat,
            role: 'user',
            parts: [{ type: 'text', text: 'overwritten' }]
          },
          'user-B'
        )
      ).rejects.toThrow()

      const rows = await owner`
        select chat_id, ui_message->'parts'->0->>'text' as text
        from messages where id = ${messageId}
      `
      expect(rows[0]).toMatchObject({ chat_id: victimChat, text: 'original' })
    })

    it("only records feedback on the user's own message", async () => {
      const chatId = `${prefix}-fb`
      const messageId = `${prefix}-fb-msg`
      seededIds.push(chatId)
      await createChat({ id: chatId, userId: 'user-A', title: 'Feedback' })
      await upsertMessage(
        { id: messageId, chatId, role: 'assistant', parts: [] },
        'user-A'
      )

      await expect(
        updateMessageFeedback(messageId, -1, 'user-B')
      ).resolves.toMatchObject({ success: false, notFound: true })
      await expect(
        updateMessageFeedback(messageId, 1, 'user-A')
      ).resolves.toMatchObject({ success: true, chatId })

      const rows = await owner`
        select metadata->>'feedbackScore' as score from messages
        where id = ${messageId}
      `
      expect(rows[0].score).toBe('1')
    })
  })
})
