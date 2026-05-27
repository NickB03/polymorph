# Parts Table Removal

**Status:** Superseded/completed. Migration `drizzle/0025_next_meltdown.sql` drops the legacy `parts` table, and `messages.ui_message` is the canonical message payload. Use this document for historical context only.

Remove the legacy `parts` table and all backward-compatibility code that reads from it.
New writes have not touched `parts` since Phase 3 Workstream 1. Every message in
production now has a `messages.ui_message` JSONB payload. No backward compat needed.

---

## Workstream 1 — Delete `scripts/backfill-chat-ui-message.ts` and its tests

The backfill script and its test file exist solely to migrate legacy `parts` rows into
`messages.ui_message`. That migration is complete; both files are dead weight.

- [ ] Delete `scripts/backfill-chat-ui-message.ts`
- [ ] Delete `scripts/__tests__/backfill-chat-ui-message.test.ts`
  - Imports `buildBackfilledUIMessage` from `../backfill-chat-ui-message` (line 5)
  - One test suite: `describe('buildBackfilledUIMessage', ...)` (lines 76–110)
- [ ] Verify no other file imports from `scripts/backfill-chat-ui-message`:
  ```bash
  grep -rn "backfill-chat-ui-message\|backfillChatUiMessages\|buildBackfilledUIMessage" \
    /Users/nick/Projects/vana-v2 \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.next
  ```
  Expected: zero hits after deletion.

---

## Workstream 2 — Remove compatibility-loading code from `lib/db/actions.ts`

### 2a. Remove `loadCompatibilityPartsByMessageId` and `buildUIMessagesFromRows`

Both functions exist only to reconstruct `UIMessage` from legacy `parts` rows for
messages whose `ui_message` column is null. After this change every row has `ui_message`,
so both functions become dead code.

- [ ] **`lib/db/actions.ts`**

  Remove the `CompatibilityPartsReader` type alias (line 71):

  ```ts
  type CompatibilityPartsReader = Pick<TxInstance, 'select'>
  ```

  Remove `loadCompatibilityPartsByMessageId` (lines 73–102):

  ```ts
  async function loadCompatibilityPartsByMessageId(...)
  ```

  Remove `buildUIMessagesFromRows` (lines 104–111):

  ```ts
  function buildUIMessagesFromRows(...)
  ```

### 2b. Simplify `loadChat` (lines 251–265)

Current code (lines 255–264):

```ts
return withOptionalRLS(userId || null, async tx => {
  const result = await tx.query.messages.findMany({
    where: eq(messages.chatId, chatId),
    orderBy: [asc(messages.createdAt)]
  })
  const compatibilityPartsByMessageId = await loadCompatibilityPartsByMessageId(
    tx,
    result
  )

  return buildUIMessagesFromRows(result, compatibilityPartsByMessageId)
})
```

Replace with:

```ts
return withOptionalRLS(userId || null, async tx => {
  const result = await tx.query.messages.findMany({
    where: eq(messages.chatId, chatId),
    orderBy: [asc(messages.createdAt)]
  })

  return result.map(message => buildUIMessageFromDB(message, []))
})
```

### 2c. Simplify `loadChatWithMessages` (lines ~540–558)

Current code (lines 551–557):

```ts
const compatibilityPartsByMessageId = await loadCompatibilityPartsByMessageId(
  tx,
  messagesResult
)
const uiMessages = buildUIMessagesFromRows(
  messagesResult,
  compatibilityPartsByMessageId
)
return { ...chat, messages: uiMessages }
```

Replace with:

```ts
const uiMessages = messagesResult.map(message =>
  buildUIMessageFromDB(message, [])
)
return { ...chat, messages: uiMessages }
```

### 2d. Remove the legacy `tx.delete(parts)` cleanup in `upsertMessage` (line 239)

This line deletes any stale `parts` rows for the message being upserted:

```ts
await tx.delete(parts).where(eq(parts.messageId, message.id))
```

Once the `parts` table is dropped in Workstream 4 this line becomes a runtime error.
Remove it now. The comment above it (lines 237–238) should also be removed.

### 2e. Clean up imports and types in `lib/db/actions.ts`

- [ ] Remove `parts` from the named import of `./schema` (line 65)
- [ ] Remove `Part` from the type import of `./schema` (line 55):
  ```ts
  import type { Chat, Message, Part } from './schema'
  ```
  Becomes:
  ```ts
  import type { Chat, Message } from './schema'
  ```
- [ ] Remove `inArray` from the `drizzle-orm` import (line 3) **only if** it is no
      longer used elsewhere in the file after these changes. Verify with:
  ```bash
  grep -n "inArray" /Users/nick/Projects/vana-v2/lib/db/actions.ts
  ```

### 2f. Remove the legacy-compat test cases in `lib/db/__tests__/chat-ui-message-load.test.ts`

Several tests specifically exercise the compatibility path:

- [ ] Remove `mockPartsSelect` helper (lines 107–115) — it mocks `tx.select` for a
      `parts` query and is only used by the legacy test below.
- [ ] Remove the test `'buildUIMessageFromDB reconstructs from legacy parts when uiMessage is null'`
      (lines 142–153) — explicitly tests the legacy path.
- [ ] Remove the test `'loadChatWithMessages queries compatibility parts only for legacy rows'`
      (lines 222–266) — tests that `tx.select` is called twice when legacy rows are present.
- [ ] Update the test `'upsertMessage updates canonical uiMessage and clears legacy parts projection'`
      (lines 304–345):
  - Remove `deleteParts` mock setup (lines 317–318) and the `partsInsert` mock (lines
    320–322)
  - Change `expect(dbMocks.tx.delete).toHaveBeenCalledTimes(1)` to `toHaveBeenCalledTimes(0)`
  - Remove the `deleteParts.where` assertion (lines 333)
  - Update mock setup: `dbMocks.tx.insert.mockReturnValueOnce(messageInsert)` (no
    second `mockReturnValueOnce(partsInsert)`)
- [ ] Update the test `'createChatWithFirstMessageTransaction persists first message without legacy parts projection'`
      (lines 347–388):
  - Remove `partsInsert` mock definition (lines 362–364)
  - Remove the third `mockReturnValueOnce(partsInsert)` chained call (line 369)
  - Assertion `expect(dbMocks.tx.insert).toHaveBeenCalledTimes(2)` already matches —
    no change needed there.
- [ ] Remove `DBMessagePartSelect` import from `lib/db/__tests__/chat-ui-message-load.test.ts`
      (line 4) and the `makeTextPart` helper (lines 49–95) once the tests above that use it
      are removed. Verify no remaining test in the file uses `makeTextPart`:
  ```bash
  grep -n "makeTextPart" /Users/nick/Projects/vana-v2/lib/db/__tests__/chat-ui-message-load.test.ts
  ```

### 2g. Remove `DBMessagePart` / `DBMessagePartSelect` from `lib/types/message-persistence.ts`

These types are derived from the `parts` table schema:

- [ ] **`lib/types/message-persistence.ts` lines 3 and 18–19:**
  ```ts
  import type { parts } from '@/lib/db/schema'
  ...
  export type DBMessagePart = typeof parts.$inferInsert
  export type DBMessagePartSelect = typeof parts.$inferSelect
  ```
  Delete those three lines.
- [ ] Verify nothing else imports `DBMessagePart` or `DBMessagePartSelect`:
  ```bash
  grep -rn "DBMessagePart\|DBMessagePartSelect" \
    /Users/nick/Projects/vana-v2 \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.next
  ```
  Expected consumers after deletion: `lib/utils/message-mapping.ts` (which uses the
  types for the legacy `buildUIMessageFromDB` parameter). That function's second
  parameter can be changed from `DBMessagePartSelect[]` to `[]` (empty array literal)
  or the parameter can be removed entirely — see Workstream 2h.

### 2h. Remove `DBMessagePart` / `DBMessagePartSelect` from `lib/utils/message-mapping.ts`

`buildUIMessageFromDB` (line 718) currently accepts `dbParts: DBMessagePartSelect[]`
as its second parameter and calls `dbParts.map(mapDBPartToUIMessagePart)` (line 756).
After this change all call sites pass `[]`, so:

- [ ] Remove the `DBMessagePart` and `DBMessagePartSelect` imports (lines 10–11).
- [ ] Change the signature of `buildUIMessageFromDB` — remove the `dbParts` parameter.
- [ ] Remove the `parts: dbParts.map(mapDBPartToUIMessagePart)` line (756) from the
      legacy-fallback branch. Since every row now has `uiMessage`, that branch
      (`if (dbMessage.uiMessage)` returning early on line 741) is the only path taken.
      The else-branch (lines 753–759) can be removed entirely or simplified to throw an
      invariant error if preferred.
- [ ] Verify `mapDBPartToUIMessagePart` and `mapUIPartsToDBParts` are no longer called
      from any live code path:
  ```bash
  grep -rn "mapDBPartToUIMessagePart\|mapUIPartsToDBParts" \
    /Users/nick/Projects/vana-v2 \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.next
  ```
  If the only references are inside `message-mapping.ts` itself, both functions and
  their supporting helpers can be deleted. If external callers exist, leave the
  functions but file a follow-up issue.

---

## Workstream 3 — Remove `parts` SQL from `services/evals/src/sampler.ts`

The sampler SQL has two layers of `parts`-table references that must both be removed:

**Layer A — eligibility filters (target-turn selection)**

These guard-conditions select only messages that have either `ui_message` or a legacy
`parts` row. Since `ui_message` is now universal, the `parts`-based OR branches are
dead.

- [ ] **Lines 112–120** — remove the `EXISTS (SELECT 1 FROM parts user_part ...)` branch
      from the `target_user` LATERAL subquery `AND (...)` condition. After removal the
      condition becomes simply `AND user_message.ui_message IS NOT NULL`.
- [ ] **Lines 127–134** — remove the `OR EXISTS (SELECT 1 FROM parts assistant_part ...)`
      branch from the `WHERE assistant.role = 'assistant' AND (...)` block. After removal
      the condition becomes simply `AND assistant.ui_message IS NOT NULL`.
- [ ] **Lines 135–145** — remove the entire `AND NOT EXISTS (SELECT 1 FROM parts
unsupported_part ...)` block. This was a guard for legacy rows that had
      unsupported tool parts in the `parts` table. The canonical `ui_message`-based guard
      (lines 146–161) already covers this for new rows.

**Layer B — data projection (`textParts` COALESCE columns)**

The `textParts` column in `conversation_messages` and `target_assistant_message` is
a `COALESCE(legacy-parts-subquery, '[]'::json)` that falls back to `parts` rows when
`ui_message` is null. Since `ui_message` is now always present, the fallback is never
reached and the entire `textParts` subquery can be removed.

- [ ] **Lines 183–195** — remove the `'textParts', COALESCE(...)` key-value from the
      `conversation_messages` `json_build_object`. The key `textParts` and its value
      (the `parts text_part` subquery) should both be removed.
- [ ] **Lines 214–226** — remove the `'textParts', COALESCE(...)` key-value from the
      `target_assistant_message` `json_build_object`. Same pattern.

**Layer C — search-results, citations, and tool-names projections**

These subqueries read directly from `parts` to populate `target_search_results`,
`target_citations`, and `target_tool_names` as fallbacks. After `parts` is dropped
they must be replaced with JSONB extraction from `ui_message`.

- [ ] **Lines 229–234 (`target_search_results`)** — replace the `FROM parts search_part`
      subquery with a `jsonb_array_elements` extraction from
      `assistant_message.ui_message->'parts'` filtered to `type = 'tool-search'`.
      New SQL (conceptual sketch):
  ```sql
  (
    SELECT json_agg(part->>'output')
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(assistant_message.ui_message->'parts') = 'array'
           THEN assistant_message.ui_message->'parts'
           ELSE '[]'::jsonb
      END
    ) AS p(part)
    WHERE part->>'type' = 'tool-search'
      AND part->'output' IS NOT NULL
  ) AS target_search_results
  ```
  Note: validate the actual JSONB shape of `tool-search` output in `ui_message` before
  writing the final SQL. The existing `normalizeSearchResultOutput` consumer expects
  `{ query, results: [{title, url, snippet}] }`.
- [ ] **Lines 236–244 (`target_citations`)** — replace the `FROM parts citation_part`
      subquery with `jsonb_array_elements` extraction from `ui_message->'parts'` filtered
      to `type = 'source-url'`.
- [ ] **Lines 246–250 (`target_tool_names`)** — replace the `FROM parts tool_part`
      subquery with `jsonb_array_elements` extraction from `ui_message->'parts'` filtered
      to `type LIKE 'tool-%'`.

**`SampleMessageRow` interface and `messageParts` fallback**

- [ ] **`SampleMessageRow` (lines 50–57)** — remove the `textParts?: unknown` field.
- [ ] **`messageParts` function (lines 299–308)** — remove the fallback branch. The
      function currently returns `parseJsonArray(message.textParts, 'text_parts')` when
      `uiMessage.parts` is absent. After this change, simplify to:
  ```ts
  function messageParts(message: SampleMessageRow): unknown[] {
    const uiMessage = asRecord(message.uiMessage)
    return Array.isArray(uiMessage?.parts) ? (uiMessage.parts as unknown[]) : []
  }
  ```

**Sampler tests that cover legacy paths**

- [ ] **`services/evals/src/sampler.test.ts` line 388** — remove the test
      `'falls back to legacy text parts and labels missing mode metadata'`. This test
      explicitly passes `uiMessage: null` with `textParts` populated to exercise the
      legacy path.
- [ ] Review all remaining `textParts` occurrences in `sampler.test.ts` (lines 131,
      143, 164, 195, 267, 301, 375) — these appear in mock data. Once `textParts` is
      removed from `SampleMessageRow`, TypeScript will flag each one. Remove the
      `textParts` keys from every mock row.
- [ ] Verify the remaining sampler tests still pass after removing the legacy SQL
      conditions (the `'prefilters replay-incompatible tools'` test at line 98 checks for
      `assistant.ui_message->'parts'` and `jsonb_array_elements` — those remain in the
      canonical guard, so that test should still pass).

---

## Workstream 4 — Drizzle migration to drop the `parts` table

- [ ] **`lib/db/schema.ts`** — delete the entire `parts` table definition:
  - Lines 128–262: the `pgTable('parts', ...)` block
  - Lines 264–265: the exported `Part` and `NewPart` types
  - Any re-export of `parts` in `lib/db/index.ts` (check with
    `grep -n "parts" /Users/nick/Projects/vana-v2/lib/db/index.ts`)
- [ ] **`drizzle/relations.ts`** — remove `parts` from the import (line 3), remove the
      `parts: many(parts)` entry from `messagesRelations` (line 10), and remove the entire
      `partsRelations` block (lines 17–22). The file should have no remaining reference
      to `parts`.
- [ ] **Generate the migration:**

  ```bash
  bun run drizzle-kit generate
  ```

  Inspect the generated file to confirm it contains:
  - `DROP TABLE IF EXISTS "parts";`
  - `DROP POLICY "users_manage_message_parts" ON "parts";`
  - `DROP POLICY "public_chat_parts_readable" ON "parts";`
  - `DROP INDEX IF EXISTS "parts_message_id_idx";`
  - `DROP INDEX IF EXISTS "parts_message_id_order_idx";`

  The cascade constraint on `message_id` means child rows are deleted with the table.
  Confirm the migration does **not** touch the `messages` table.

- [ ] **Apply migration locally:**
  ```bash
  npx supabase start   # if not already running
  bun run migrate
  ```

---

## Workstream 5 — Verification

Run all checks in order. Each must pass before moving to the next.

- [ ] **TypeScript:**

  ```bash
  bun typecheck
  ```

  Fix every error before proceeding. Common expected errors: lingering `Part` /
  `DBMessagePart` / `DBMessagePartSelect` references, leftover `parts` Drizzle
  references, and `buildUIMessageFromDB` call sites that still pass a second argument.

- [ ] **Lint:**

  ```bash
  bun lint
  ```

  Fix every warning.

- [ ] **App test suite:**

  ```bash
  bun run test
  ```

  Expected green: all tests pass. Files most likely to have failures:
  - `lib/db/__tests__/chat-ui-message-load.test.ts`
  - `scripts/__tests__/backfill-chat-ui-message.test.ts` (deleted — should not appear)

- [ ] **Evals test suite:**

  ```bash
  cd services/evals && bun run test
  ```

  Expected green: `sampler.test.ts` should pass after legacy test removal and
  `textParts` cleanup. The `'prefilters replay-incompatible tools'` test should still
  pass because the canonical JSONB guard remains in the SQL.

- [ ] **Build:**

  ```bash
  bun run build
  ```

  No build errors.

- [ ] **Schema snapshot check:** After migration, confirm Drizzle schema and DB are
      in sync:
  ```bash
  bun run drizzle-kit check
  ```

---

## Execution order

The workstreams are ordered so that each step leaves the codebase in a compilable,
passing state:

1. **WS 1** (delete backfill script + test) — isolated, no dependents.
2. **WS 2** (remove app compatibility code) — removes `parts` Drizzle ORM calls; must
   happen before WS 4 removes the table definition from schema.
3. **WS 3** (sampler SQL rewrite) — independent of WS 2; can be done in parallel.
4. **WS 4** (schema + migration) — must be last code change before running final
   verification.
5. **WS 5** (verification) — gate for PR.

Do not open a PR until WS 5 passes completely.
