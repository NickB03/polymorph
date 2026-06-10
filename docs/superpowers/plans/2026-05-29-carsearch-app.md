# Carsearch Polymorph App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static EV Tracker output into a real Polymorph-hosted car-shopping application with refreshed listings, shared saved cars, notes, price history, and mobile-first browsing.

**Architecture:** Build this inside the existing Polymorph Next.js app at `/carsearch` instead of creating a new repo or Vercel project. Reuse the current Vercel deployment, Drizzle/Postgres connection, Supabase auth, Vercel Cron, shadcn/Radix primitives, Tailwind v4, and existing privileged DB helper. Add clearly prefixed `carsearch_*` tables so the feature is isolated without creating another database or set of API keys.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Bun, Tailwind v4, Drizzle ORM, existing Supabase/Postgres, Vercel Cron, `node-html-parser`, Zod, Vitest, Testing Library, browser QA on `bun dev -p 43100`.

---

## Source Analysis

The existing static app lives at:

`/Users/nick/Library/Application Support/Claude/local-agent-mode-sessions/c9865b72-4074-432e-ae40-dc79d30f7a2f/5dc41041-dea1-44e2-9e9e-d9fe094f3c6e/local_0548136f-15dc-4eff-bd73-5c15682b3a2b/outputs/ev-tracker`

What it already does well:

- `README.md:7-21` shows a clean split between browse page, listing detail page, data, filters, card renderer, and detail renderer.
- `README.md:61-71` confirms the hard limitation: `js/data.js` is the source of truth and saved cars/notes are localStorage-only.
- The snapshot contains 42 listings scraped on May 28, 2026: 26 Ford, 13 Volvo, 3 Polestar; 41 non-lemon active listings; 6 top picks.
- `js/helpers.js:10-38` contains the plain-English labels that should be preserved.
- `js/helpers.js:56-65` contains VIN-specific top-pick rationales that need to move into seed data or DB rows.
- `js/filters.js:15-24` contains the exact recommendation score. Keep this contract.
- `js/filters.js:27-39` confirms the default browse behavior: hide lemon listings; when the "Verified driver assist" toggle is on, show only `assist === 'std' && awd`.

The old generated `BUILD_PLAN.md` has useful product requirements, but it should not be followed as-is:

- It proposes a fresh Next.js 14 app, Tailwind 3, Neon, and Cheerio. This repo already has Next 16, Tailwind 4, Drizzle/Postgres, Vercel deployment scripts, Supabase auth, Vercel Cron, and `node-html-parser`.
- It treats the static HTML as a separate scaffold. For this repo, the right move is a route group plus feature modules inside Polymorph.
- It suggests no component library. This repo already uses local shadcn/Radix primitives; reuse them for dialog, select, textarea, buttons, skeletons, and accessible controls.

Repo evidence that shapes this plan:

- `package.json:7-17` already defines the dev, build, migrate, lint, typecheck, and test commands.
- `package.json:87-103` already has Drizzle, Postgres, Next, and `node-html-parser`.
- `vercel.json:3-8` already has Vercel Cron wiring.
- `app/layout.tsx:33-38` sets `overflow-hidden` on the root body, so the carsearch route must own its own scroll container.
- `lib/db/schema.ts:31-72` shows the repo's RLS pattern using `current_setting('app.current_user_id', true)`.
- `lib/db/schema.ts:578-598` shows a singleton public cache table pattern that is useful for public listing reads.
- `lib/db/admin.ts:26-76` is the established privileged write path for cron/admin code.
- `lib/db/with-rls.ts:41-91` is available for user-scoped operations, but this plan keeps shared household saves behind server-side auth checks and privileged writes.
- `app/api/suggestions/refresh/route.ts:10-27` is the existing `CRON_SECRET` pattern to reuse.
- `proxy.ts:5-25` already owns request/session middleware and is the right place for an optional `carsearch.polymorph.fyi` host rewrite later.

## Product Decisions

1. **Use Polymorph as the host.** The first shipped version is `https://polymorph.fyi/carsearch` or the Vercel preview equivalent. A `carsearch.polymorph.fyi` host can be added after the route is stable.
2. **Do not create a new Vercel project, Supabase project, Neon database, or external listing API account.** Add `carsearch_*` tables to the current database. This keeps setup almost entirely inside the existing environment.
3. **Public browse, authenticated shared saves.** Anyone with the URL can browse current active listings. Save/unsave, notes, status, and top-pick/admin overrides require an allowed logged-in Supabase user. The allowed list is `CARSEARCH_ALLOWED_USER_IDS`, falling back to existing `ADMIN_USER_ID`.
4. **One shared household board.** This is not a SaaS feature. Saved listings are shared across allowed users, so Nick and his wife see the same shortlist.
5. **Seed first, scrape second.** The static May 28, 2026 snapshot becomes the initial database seed so the UI can ship quickly. Automated refresh follows with tests and fixtures.
6. **Use plain `<img>`, not `next/image`, for listing photos.** Edmunds image URLs are external and volatile; plain images match the static app's fallback behavior and avoid broadening `next.config.mjs` image allowlists in v1.
7. **No email digest in MVP.** Price drops and new listings appear in-app first. Email adds new provider setup and should wait until the browsing loop is useful.

## File Structure

Create:

| Path                                                   | Responsibility                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `app/(carsearch)/carsearch/layout.tsx`                 | Route-group shell with its own scroll surface, no chat sidebar/canvas.                                      |
| `app/(carsearch)/carsearch/page.tsx`                   | Server entry for browse page; loads listings, saved state, refresh metadata, and current user capabilities. |
| `app/(carsearch)/carsearch/[vin]/page.tsx`             | Server entry for listing details.                                                                           |
| `app/(carsearch)/carsearch/loading.tsx`                | Route skeleton.                                                                                             |
| `app/api/carsearch/saved/route.ts`                     | Authenticated read/create/update saved-listing state.                                                       |
| `app/api/carsearch/saved/[vin]/route.ts`               | Authenticated delete/patch for one saved listing.                                                           |
| `app/api/carsearch/refresh/route.ts`                   | Cron/manual refresh route protected by `CRON_SECRET`.                                                       |
| `components/carsearch/browse-shell.tsx`                | Client-owned filters, sorting, saved-only toggle, optimistic save state, and load-more state.               |
| `components/carsearch/car-card.tsx`                    | Listing card converted from `card.js`.                                                                      |
| `components/carsearch/car-detail.tsx`                  | Listing detail view converted from `detail.js`.                                                             |
| `components/carsearch/filter-bar.tsx`                  | Sticky brand/toggle/sort controls.                                                                          |
| `components/carsearch/header.tsx`                      | Title, tagline, commute band, and "Why these cars?" dialog trigger.                                         |
| `components/carsearch/listing-image.tsx`               | Plain `<img>` plus silhouette fallback.                                                                     |
| `components/carsearch/saved-controls.tsx`              | Save button, status select, notes textarea.                                                                 |
| `components/carsearch/external-links.tsx`              | Dealer/search deep links.                                                                                   |
| `components/carsearch/about-panels.tsx`                | Native collapsible methodology and buying checklist panels.                                                 |
| `lib/carsearch/types.ts`                               | Listing, filter, sort, saved-state, and refresh-run types.                                                  |
| `lib/carsearch/copy.ts`                                | Plain-language feature labels from `helpers.js`.                                                            |
| `lib/carsearch/scoring.ts`                             | Recommendation score, filters, sort, freshness helpers.                                                     |
| `lib/carsearch/auth.ts`                                | Allowed-user check for saves/admin operations.                                                              |
| `lib/carsearch/queries.ts`                             | Server reads for public listings, details, saved state, and refresh metadata.                               |
| `lib/carsearch/mutations.ts`                           | Server writes for saved state and refresh upserts.                                                          |
| `lib/carsearch/seed/ev-tracker-snapshot.json`          | Generated JSON copy of the existing 42-listing snapshot.                                                    |
| `lib/carsearch/seed/snapshot.ts`                       | Zod validation and normalization for the seed snapshot.                                                     |
| `lib/carsearch/sources.ts`                             | Search source definitions for Edmunds and future sources.                                                   |
| `lib/carsearch/parsers/edmunds.ts`                     | Tested Edmunds parser using `node-html-parser`.                                                             |
| `lib/carsearch/refresh.ts`                             | Refresh orchestration: fetch sources, parse, upsert, price history, mark stale.                             |
| `lib/carsearch/__tests__/copy.test.ts`                 | Plain-language label tests.                                                                                 |
| `lib/carsearch/__tests__/scoring.test.ts`              | Recommendation/filter/sort tests.                                                                           |
| `lib/carsearch/__tests__/snapshot.test.ts`             | Validates imported May 28 snapshot.                                                                         |
| `lib/carsearch/parsers/__tests__/edmunds.test.ts`      | Parser fixture tests.                                                                                       |
| `components/carsearch/__tests__/browse-shell.test.tsx` | Filter/save UI behavior tests.                                                                              |
| `components/carsearch/__tests__/car-card.test.tsx`     | Card rendering tests.                                                                                       |
| `scripts/carsearch/import-ev-tracker-snapshot.ts`      | One-time importer from the generated static `data.js` into JSON.                                            |
| `scripts/carsearch/seed-carsearch.ts`                  | Seeds the DB from `ev-tracker-snapshot.json`.                                                               |

Modify:

| Path                  | Change                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `lib/db/schema.ts`    | Add `carsearch_*` tables and types.                                                                  |
| `lib/db/relations.ts` | Add relations for listings, price history, and saved listing.                                        |
| `vercel.json`         | Add a daily carsearch refresh cron entry.                                                            |
| `proxy.ts`            | Optional later: rewrite `carsearch.polymorph.fyi/` to `/carsearch` after the path route is verified. |
| `next.config.mjs`     | No MVP change if using plain `<img>`. Only revisit if switching to `next/image`.                     |

## Database Design

Add these tables to `lib/db/schema.ts` with names exactly as shown.

```ts
export const carsearchListings = pgTable(
  'carsearch_listings',
  {
    vin: varchar('vin', { length: 32 }).primaryKey(),
    brand: varchar('brand', {
      length: VARCHAR_LENGTH,
      enum: ['ford', 'volvo', 'polestar']
    }).notNull(),
    model: varchar('model', { length: VARCHAR_LENGTH }).notNull(),
    modelLabel: text('model_label').notNull(),
    year: integer('year').notNull(),
    trim: text('trim').notNull(),
    trimType: varchar('trim_type', { length: VARCHAR_LENGTH }).notNull(),
    awd: boolean('awd').notNull(),
    price: integer('price').notNull(),
    miles: integer('miles').notNull(),
    epaRangeMiles: integer('epa_range_miles').notNull(),
    location: text('location').notNull(),
    distanceMiles: integer('distance_miles').notNull(),
    locationType: varchar('location_type', {
      length: VARCHAR_LENGTH,
      enum: ['dfw', 'tx', 'online']
    }).notNull(),
    deal: varchar('deal', {
      length: VARCHAR_LENGTH,
      enum: ['great price', 'good price', 'fair price']
    }),
    cpo: boolean('cpo').notNull().default(false),
    assist: varchar('assist', {
      length: VARCHAR_LENGTH,
      enum: ['std', 'verify', 'no']
    }).notNull(),
    lemon: boolean('lemon').notNull().default(false),
    topPick: boolean('top_pick').notNull().default(false),
    topPickReason: text('top_pick_reason'),
    features: jsonb('features')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    imageUrl: text('image_url'),
    sourceUrl: text('source_url').notNull(),
    sourceSite: varchar('source_site', { length: VARCHAR_LENGTH }).notNull(),
    listedSince: timestamp('listed_since', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  table => [
    index('carsearch_listings_active_brand_idx').on(
      table.isActive,
      table.brand
    ),
    index('carsearch_listings_source_site_idx').on(table.sourceSite),
    pgPolicy('public_read_active_carsearch_listings', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`is_active = true`
    })
  ]
).enableRLS()
```

```ts
export const carsearchPriceHistory = pgTable(
  'carsearch_price_history',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    vin: varchar('vin', { length: 32 })
      .notNull()
      .references(() => carsearchListings.vin, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    price: integer('price').notNull(),
    sourceSite: varchar('source_site', { length: VARCHAR_LENGTH }).notNull()
  },
  table => [
    index('carsearch_price_history_vin_observed_idx').on(
      table.vin,
      table.observedAt.desc()
    ),
    pgPolicy('public_read_carsearch_price_history', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`
    })
  ]
).enableRLS()
```

```ts
export const carsearchSavedListings = pgTable(
  'carsearch_saved_listings',
  {
    vin: varchar('vin', { length: 32 })
      .primaryKey()
      .references(() => carsearchListings.vin, { onDelete: 'cascade' }),
    savedByUserId: varchar('saved_by_user_id', {
      length: USER_ID_LENGTH
    }).notNull(),
    status: varchar('status', {
      length: VARCHAR_LENGTH,
      enum: ['saved', 'contacted', 'test_drive', 'rejected', 'purchased']
    })
      .notNull()
      .default('saved'),
    note: text('note'),
    savedAt: timestamp('saved_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  table => [index('carsearch_saved_status_idx').on(table.status)]
).enableRLS()
```

```ts
export const carsearchRefreshRuns = pgTable(
  'carsearch_refresh_runs',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: varchar('status', {
      length: VARCHAR_LENGTH,
      enum: ['running', 'success', 'failed']
    }).notNull(),
    sourceSite: varchar('source_site', { length: VARCHAR_LENGTH }).notNull(),
    seenCount: integer('seen_count').notNull().default(0),
    insertedCount: integer('inserted_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    deactivatedCount: integer('deactivated_count').notNull().default(0),
    error: text('error')
  },
  table => [
    index('carsearch_refresh_runs_started_idx').on(table.startedAt.desc()),
    pgPolicy('public_read_carsearch_refresh_runs', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`
    })
  ]
).enableRLS()
```

Access rules:

- `carsearch_listings`, `carsearch_price_history`, and `carsearch_refresh_runs` are public read.
- `carsearch_saved_listings` has no public policy. Read/write it only through server routes after `canManageCarsearch(user.id)` succeeds, using `getPrivilegedDb()`.
- Refresh writes use `getPrivilegedDb()` like `/api/suggestions/refresh`.

## Phase 0 - Baseline And Snapshot Extraction

### Task 0: Verify The Starting Point

**Files:** none

- [ ] **Step 1: Confirm the worktree state**

Run:

```bash
git status --short --branch
```

Expected: no unrelated edits in this worktree. If unrelated edits exist, list them before touching files.

- [ ] **Step 2: Confirm current repo gates before feature work**

Run:

```bash
bun lint
bun typecheck
```

Expected: both pass. If they fail, capture exact errors before editing.

- [ ] **Step 3: Inspect the static app in a browser**

Run:

```bash
cd "/Users/nick/Library/Application Support/Claude/local-agent-mode-sessions/c9865b72-4074-432e-ae40-dc79d30f7a2f/5dc41041-dea1-44e2-9e9e-d9fe094f3c6e/local_0548136f-15dc-4eff-bd73-5c15682b3a2b/outputs/ev-tracker"
python3 -m http.server 43820
```

Open `http://localhost:43820`. Verify browse, filters, saved-only localStorage, detail page, notes, and the "Why these cars?" modal.

- [ ] **Step 4: Commit nothing**

This task only records baseline evidence.

### Task 1: Import The Static Snapshot As Typed Seed Data

**Files:**

- Create: `scripts/carsearch/import-ev-tracker-snapshot.ts`
- Create: `lib/carsearch/types.ts`
- Create: `lib/carsearch/seed/ev-tracker-snapshot.json`
- Create: `lib/carsearch/seed/snapshot.ts`
- Create: `lib/carsearch/__tests__/snapshot.test.ts`

- [ ] **Step 1: Add core types**

Create `lib/carsearch/types.ts`:

```ts
export type CarsearchBrand = 'ford' | 'volvo' | 'polestar'
export type CarsearchAssist = 'std' | 'verify' | 'no'
export type CarsearchDeal = 'great price' | 'good price' | 'fair price' | null
export type CarsearchLocationType = 'dfw' | 'tx' | 'online'
export type CarsearchSortKey =
  | 'recommended'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'miles-asc'
  | 'range-desc'
  | 'distance-asc'

export type CarsearchListing = {
  vin: string
  brand: CarsearchBrand
  model: string
  modelLabel: string
  year: number
  trim: string
  trimType: string
  awd: boolean
  price: number
  miles: number
  epaRangeMiles: number
  location: string
  distanceMiles: number
  locationType: CarsearchLocationType
  deal: CarsearchDeal
  cpo: boolean
  assist: CarsearchAssist
  lemon: boolean
  topPick: boolean
  topPickReason: string | null
  features: string[]
  imageUrl: string | null
  sourceUrl: string
  sourceSite: 'edmunds' | 'carvana' | 'dealer'
  listedSince: string | null
  firstSeenAt: string
  lastSeenAt: string
  isActive: boolean
}

export type CarsearchSavedListing = {
  vin: string
  status: 'saved' | 'contacted' | 'test_drive' | 'rejected' | 'purchased'
  note: string | null
  savedByUserId: string
  savedAt: string
  updatedAt: string
}

export type CarsearchFilters = {
  brand: CarsearchBrand | 'all'
  confirmedOnly: boolean
  savedOnly: boolean
  sort: CarsearchSortKey
}
```

- [ ] **Step 2: Add the importer**

Create `scripts/carsearch/import-ev-tracker-snapshot.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import vm from 'node:vm'

const sourceArg = process.argv.find(arg => arg.startsWith('--source='))
const outArg = process.argv.find(arg => arg.startsWith('--out='))

if (!sourceArg || !outArg) {
  console.error(
    'Usage: bun run scripts/carsearch/import-ev-tracker-snapshot.ts --source=/path/to/data.js --out=lib/carsearch/seed/ev-tracker-snapshot.json'
  )
  process.exit(1)
}

const source = sourceArg.slice('--source='.length)
const out = outArg.slice('--out='.length)
const code = `${await readFile(source, 'utf8')}\nthis.LISTINGS = LISTINGS`
const sandbox: { LISTINGS?: any[] } = {}

vm.createContext(sandbox)
vm.runInContext(code, sandbox)

if (!Array.isArray(sandbox.LISTINGS)) {
  throw new Error('LISTINGS array was not found in source data.js')
}

const now = '2026-05-28T00:00:00.000Z'
const topPickReasons: Record<string, string> = {
  '3FMTK3SU8SMA01062':
    'Lowest price for a near-new Certified Ford with hands-free driving. Texas-based dealer - no shipping needed.',
  '3FMTK4SX5SMA11550':
    'Most range of any car on the list (306 mi) and Ford Certified. Sportier GT version.',
  '3FMTK3R78PMA65898':
    "Best 2023 deal close to home (18 mi). Includes Ford's hands-free highway system.",
  YV4ED3GM3P2026771:
    'Same safety system as your XC90, Volvo Certified, lowest miles among Volvos.',
  YV4ED3UM0P2011701:
    'SUV version of the Volvo C40 - more cargo room. Certified with 7-year warranty.'
}

const normalized = sandbox.LISTINGS.map(listing => ({
  vin: listing.id,
  brand: listing.brand,
  model: listing.model,
  modelLabel: listing.modelLabel,
  year: listing.year,
  trim: listing.trim,
  trimType: listing.trimType,
  awd: listing.awd,
  price: listing.price,
  miles: listing.miles,
  epaRangeMiles: listing.range,
  location: listing.location,
  distanceMiles: listing.distance,
  locationType: listing.locType,
  deal: listing.deal === '-' || listing.deal === '—' ? null : listing.deal,
  cpo: listing.cpo,
  assist: listing.assist,
  lemon: listing.lemon,
  topPick: !!listing.topPick,
  topPickReason: topPickReasons[listing.id] ?? null,
  features: listing.features ?? [],
  imageUrl: listing.imageUrl ?? null,
  sourceUrl: listing.url,
  sourceSite: 'edmunds',
  listedSince: listing.listedSince
    ? `${listing.listedSince}T00:00:00.000Z`
    : null,
  firstSeenAt: now,
  lastSeenAt: now,
  isActive: true
}))

await mkdir(dirname(out), { recursive: true })
await writeFile(out, `${JSON.stringify(normalized, null, 2)}\n`)

console.log(`Wrote ${normalized.length} listings to ${out}`)
```

- [ ] **Step 3: Generate the seed JSON**

Run:

```bash
bun run scripts/carsearch/import-ev-tracker-snapshot.ts \
  --source="/Users/nick/Library/Application Support/Claude/local-agent-mode-sessions/c9865b72-4074-432e-ae40-dc79d30f7a2f/5dc41041-dea1-44e2-9e9e-d9fe094f3c6e/local_0548136f-15dc-4eff-bd73-5c15682b3a2b/outputs/ev-tracker/js/data.js" \
  --out=lib/carsearch/seed/ev-tracker-snapshot.json
```

Expected: `Wrote 42 listings to lib/carsearch/seed/ev-tracker-snapshot.json`.

- [ ] **Step 4: Add seed validation**

Create `lib/carsearch/seed/snapshot.ts`:

```ts
import { z } from 'zod'

import type { CarsearchListing } from '@/lib/carsearch/types'

import snapshot from './ev-tracker-snapshot.json'

const listingSchema = z.object({
  vin: z.string().min(11),
  brand: z.enum(['ford', 'volvo', 'polestar']),
  model: z.string().min(1),
  modelLabel: z.string().min(1),
  year: z.number().int().min(2018).max(2030),
  trim: z.string().min(1),
  trimType: z.string().min(1),
  awd: z.boolean(),
  price: z.number().int().positive(),
  miles: z.number().int().nonnegative(),
  epaRangeMiles: z.number().int().positive(),
  location: z.string().min(1),
  distanceMiles: z.number().int().nonnegative(),
  locationType: z.enum(['dfw', 'tx', 'online']),
  deal: z.enum(['great price', 'good price', 'fair price']).nullable(),
  cpo: z.boolean(),
  assist: z.enum(['std', 'verify', 'no']),
  lemon: z.boolean(),
  topPick: z.boolean(),
  topPickReason: z.string().nullable(),
  features: z.array(z.string()),
  imageUrl: z.string().url().nullable(),
  sourceUrl: z.string().url(),
  sourceSite: z.enum(['edmunds', 'carvana', 'dealer']),
  listedSince: z.string().datetime().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  isActive: z.boolean()
})

export const carsearchSeedListings = z
  .array(listingSchema)
  .parse(snapshot) satisfies CarsearchListing[]
```

- [ ] **Step 5: Test the seed contract**

Create `lib/carsearch/__tests__/snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'

describe('carsearch seed snapshot', () => {
  it('contains the imported EV Tracker snapshot', () => {
    expect(carsearchSeedListings).toHaveLength(42)
    expect(
      carsearchSeedListings.filter(listing => !listing.lemon)
    ).toHaveLength(41)
    expect(
      carsearchSeedListings.filter(listing => listing.topPick)
    ).toHaveLength(6)
  })

  it('preserves the expected source mix', () => {
    expect(
      carsearchSeedListings.filter(listing => listing.brand === 'ford')
    ).toHaveLength(26)
    expect(
      carsearchSeedListings.filter(listing => listing.brand === 'volvo')
    ).toHaveLength(13)
    expect(
      carsearchSeedListings.filter(listing => listing.brand === 'polestar')
    ).toHaveLength(3)
  })
})
```

- [ ] **Step 6: Run the seed test**

Run:

```bash
bun run test -- lib/carsearch/__tests__/snapshot.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/carsearch/import-ev-tracker-snapshot.ts lib/carsearch/types.ts lib/carsearch/seed lib/carsearch/__tests__/snapshot.test.ts
git commit -m "feat(carsearch): import static listing snapshot"
```

## Phase 1 - Core Rules, Schema, And Seeded Data

### Task 2: Port Copy, Filtering, And Recommendation Rules

**Files:**

- Create: `lib/carsearch/copy.ts`
- Create: `lib/carsearch/scoring.ts`
- Create: `lib/carsearch/__tests__/copy.test.ts`
- Create: `lib/carsearch/__tests__/scoring.test.ts`

- [ ] **Step 1: Add plain-language copy helpers**

Create `lib/carsearch/copy.ts`:

```ts
import type { CarsearchListing } from '@/lib/carsearch/types'

export function driverAssistCopy(
  listing: Pick<CarsearchListing, 'assist' | 'brand'>
) {
  if (listing.assist === 'std' && listing.brand === 'ford') {
    return {
      tone: 'good' as const,
      text: 'Hands-free driving on highways (BlueCruise)'
    }
  }
  if (listing.assist === 'std') {
    return {
      tone: 'good' as const,
      text: 'Same safety system as your XC90 (Pilot Assist)'
    }
  }
  if (listing.assist === 'verify' && listing.brand === 'ford') {
    return {
      tone: 'warn' as const,
      text: 'Hands-free driving - verify with dealer'
    }
  }
  if (listing.assist === 'verify') {
    return {
      tone: 'warn' as const,
      text: 'Safety system optional - verify with dealer'
    }
  }
  return { tone: 'info' as const, text: 'Driver assist not confirmed' }
}

export function rangeCopy(rangeMiles: number) {
  if (rangeMiles >= 240) {
    return {
      tone: 'good' as const,
      text: `${rangeMiles}-mile range - easy fit for your commute`
    }
  }
  if (rangeMiles >= 200) {
    return {
      tone: 'good' as const,
      text: `${rangeMiles}-mile range - works with home charging`
    }
  }
  return {
    tone: 'warn' as const,
    text: `${rangeMiles}-mile range - tight for daily drive`
  }
}

export function awdCopy(awd: boolean) {
  return awd
    ? { tone: 'good' as const, text: 'All-wheel drive' }
    : { tone: 'warn' as const, text: 'Front-wheel drive - not what you wanted' }
}

export function warrantyCopy(listing: Pick<CarsearchListing, 'brand' | 'cpo'>) {
  if (!listing.cpo) return null
  if (listing.brand === 'volvo') {
    return {
      tone: 'good' as const,
      text: 'Volvo Certified - 7yr / 100k warranty'
    }
  }
  if (listing.brand === 'ford') {
    return {
      tone: 'good' as const,
      text: 'Ford EV Certified - extended warranty'
    }
  }
  if (listing.brand === 'polestar') {
    return {
      tone: 'good' as const,
      text: 'Polestar Certified - extended warranty'
    }
  }
  return { tone: 'good' as const, text: 'Manufacturer Certified' }
}
```

- [ ] **Step 2: Add scoring and filtering**

Create `lib/carsearch/scoring.ts`:

```ts
import type {
  CarsearchFilters,
  CarsearchListing,
  CarsearchSortKey
} from '@/lib/carsearch/types'

export const defaultCarsearchFilters: CarsearchFilters = {
  brand: 'all',
  confirmedOnly: true,
  savedOnly: false,
  sort: 'recommended'
}

export function recommendationScore(listing: CarsearchListing) {
  let score = 0
  if (listing.topPick) score += 1000
  if (listing.assist === 'std') score += 100
  if (listing.awd) score += 100
  if (listing.cpo) score += 30
  if (listing.distanceMiles < 30) score += 50
  if (listing.epaRangeMiles >= 240) score += 30
  score -= listing.miles / 1000
  return score
}

export function filterListings(
  listings: CarsearchListing[],
  filters: CarsearchFilters,
  savedVins: Set<string>
) {
  return listings.filter(listing => {
    if (listing.lemon) return false
    if (!listing.isActive) return false
    if (filters.brand !== 'all' && listing.brand !== filters.brand) return false
    if (filters.confirmedOnly && (listing.assist !== 'std' || !listing.awd))
      return false
    if (filters.savedOnly && !savedVins.has(listing.vin)) return false
    return true
  })
}

export function sortListings(
  listings: CarsearchListing[],
  sortKey: CarsearchSortKey
) {
  return [...listings].sort((a, b) => {
    if (sortKey === 'recommended')
      return recommendationScore(b) - recommendationScore(a)
    if (sortKey === 'newest')
      return (b.listedSince ?? '').localeCompare(a.listedSince ?? '')
    if (sortKey === 'price-asc') return a.price - b.price
    if (sortKey === 'price-desc') return b.price - a.price
    if (sortKey === 'miles-asc') return a.miles - b.miles
    if (sortKey === 'range-desc') return b.epaRangeMiles - a.epaRangeMiles
    if (sortKey === 'distance-asc') return a.distanceMiles - b.distanceMiles
    return 0
  })
}

export function splitTopPicks(
  listings: CarsearchListing[],
  sortKey: CarsearchSortKey
) {
  if (sortKey !== 'recommended') {
    return { topPicks: [], rest: listings }
  }
  return {
    topPicks: listings.filter(listing => listing.topPick),
    rest: listings.filter(listing => !listing.topPick)
  }
}
```

- [ ] **Step 3: Add copy tests**

Create `lib/carsearch/__tests__/copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  awdCopy,
  driverAssistCopy,
  rangeCopy,
  warrantyCopy
} from '@/lib/carsearch/copy'

describe('carsearch copy helpers', () => {
  it('uses the preserved plain-English driver assist labels', () => {
    expect(driverAssistCopy({ assist: 'std', brand: 'ford' }).text).toBe(
      'Hands-free driving on highways (BlueCruise)'
    )
    expect(driverAssistCopy({ assist: 'std', brand: 'volvo' }).text).toBe(
      'Same safety system as your XC90 (Pilot Assist)'
    )
    expect(driverAssistCopy({ assist: 'verify', brand: 'ford' }).text).toBe(
      'Hands-free driving - verify with dealer'
    )
    expect(driverAssistCopy({ assist: 'verify', brand: 'polestar' }).text).toBe(
      'Safety system optional - verify with dealer'
    )
  })

  it('uses commute-specific range tiers', () => {
    expect(rangeCopy(240).text).toBe(
      '240-mile range - easy fit for your commute'
    )
    expect(rangeCopy(220).text).toBe(
      '220-mile range - works with home charging'
    )
    expect(rangeCopy(190).text).toBe('190-mile range - tight for daily drive')
  })

  it('uses the preserved AWD and CPO labels', () => {
    expect(awdCopy(true).text).toBe('All-wheel drive')
    expect(awdCopy(false).text).toBe('Front-wheel drive - not what you wanted')
    expect(warrantyCopy({ cpo: true, brand: 'volvo' })?.text).toBe(
      'Volvo Certified - 7yr / 100k warranty'
    )
  })
})
```

- [ ] **Step 4: Add scoring tests**

Create `lib/carsearch/__tests__/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'
import {
  defaultCarsearchFilters,
  filterListings,
  recommendationScore,
  sortListings,
  splitTopPicks
} from '@/lib/carsearch/scoring'

describe('carsearch scoring', () => {
  it('matches the static EV Tracker recommendation formula', () => {
    const listing = carsearchSeedListings.find(
      item => item.vin === '3FMTK3R78PMA65898'
    )
    expect(listing).toBeDefined()
    expect(recommendationScore(listing!)).toBeCloseTo(1265.35)
  })

  it('defaults to non-lemon active confirmed AWD listings', () => {
    const filtered = filterListings(
      carsearchSeedListings,
      defaultCarsearchFilters,
      new Set()
    )

    expect(filtered.every(listing => !listing.lemon)).toBe(true)
    expect(filtered.every(listing => listing.isActive)).toBe(true)
    expect(
      filtered.every(listing => listing.assist === 'std' && listing.awd)
    ).toBe(true)
  })

  it('splits top picks only for recommended sort', () => {
    const sorted = sortListings(carsearchSeedListings, 'recommended')
    expect(splitTopPicks(sorted, 'recommended').topPicks).toHaveLength(6)
    expect(splitTopPicks(sorted, 'price-asc').topPicks).toHaveLength(0)
  })
})
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun run test -- lib/carsearch
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/carsearch/copy.ts lib/carsearch/scoring.ts lib/carsearch/__tests__/copy.test.ts lib/carsearch/__tests__/scoring.test.ts
git commit -m "feat(carsearch): port listing copy and ranking rules"
```

### Task 3: Add Drizzle Tables And Seed Script

**Files:**

- Modify: `lib/db/schema.ts`
- Modify: `lib/db/relations.ts`
- Create: `scripts/carsearch/seed-carsearch.ts`
- Create: generated migration in `drizzle/*.sql`

- [ ] **Step 1: Add the schema**

Add the database design from the "Database Design" section to `lib/db/schema.ts`. Import no new Drizzle primitives unless needed; existing imports already include `boolean`, `index`, `integer`, `jsonb`, `pgPolicy`, `pgTable`, `text`, `timestamp`, `varchar`, and `sql`.

- [ ] **Step 2: Add relations**

In `lib/db/relations.ts`, import the new tables and add:

```ts
export const carsearchListingsRelations = relations(
  carsearchListings,
  ({ many, one }) => ({
    priceHistory: many(carsearchPriceHistory),
    saved: one(carsearchSavedListings, {
      fields: [carsearchListings.vin],
      references: [carsearchSavedListings.vin]
    })
  })
)

export const carsearchPriceHistoryRelations = relations(
  carsearchPriceHistory,
  ({ one }) => ({
    listing: one(carsearchListings, {
      fields: [carsearchPriceHistory.vin],
      references: [carsearchListings.vin]
    })
  })
)

export const carsearchSavedListingsRelations = relations(
  carsearchSavedListings,
  ({ one }) => ({
    listing: one(carsearchListings, {
      fields: [carsearchSavedListings.vin],
      references: [carsearchListings.vin]
    })
  })
)
```

- [ ] **Step 3: Generate migration**

Run:

```bash
bunx drizzle-kit generate
```

Expected: one new SQL file under `drizzle/` creating the four `carsearch_*` tables and RLS policies.

- [ ] **Step 4: Add the seed script**

Create `scripts/carsearch/seed-carsearch.ts`:

```ts
import { eq } from 'drizzle-orm'

import { getPrivilegedDb } from '@/lib/db/admin'
import { carsearchListings, carsearchPriceHistory } from '@/lib/db/schema'
import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'

const db = await getPrivilegedDb()

for (const listing of carsearchSeedListings) {
  const listedSince = listing.listedSince ? new Date(listing.listedSince) : null
  const firstSeenAt = new Date(listing.firstSeenAt)
  const lastSeenAt = new Date(listing.lastSeenAt)

  await db
    .insert(carsearchListings)
    .values({
      vin: listing.vin,
      brand: listing.brand,
      model: listing.model,
      modelLabel: listing.modelLabel,
      year: listing.year,
      trim: listing.trim,
      trimType: listing.trimType,
      awd: listing.awd,
      price: listing.price,
      miles: listing.miles,
      epaRangeMiles: listing.epaRangeMiles,
      location: listing.location,
      distanceMiles: listing.distanceMiles,
      locationType: listing.locationType,
      deal: listing.deal,
      cpo: listing.cpo,
      assist: listing.assist,
      lemon: listing.lemon,
      topPick: listing.topPick,
      topPickReason: listing.topPickReason,
      features: listing.features,
      imageUrl: listing.imageUrl,
      sourceUrl: listing.sourceUrl,
      sourceSite: listing.sourceSite,
      listedSince,
      firstSeenAt,
      lastSeenAt,
      isActive: listing.isActive,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: carsearchListings.vin,
      set: {
        price: listing.price,
        miles: listing.miles,
        epaRangeMiles: listing.epaRangeMiles,
        location: listing.location,
        distanceMiles: listing.distanceMiles,
        deal: listing.deal,
        cpo: listing.cpo,
        assist: listing.assist,
        lemon: listing.lemon,
        topPick: listing.topPick,
        topPickReason: listing.topPickReason,
        imageUrl: listing.imageUrl,
        sourceUrl: listing.sourceUrl,
        listedSince,
        lastSeenAt,
        isActive: listing.isActive,
        updatedAt: new Date()
      }
    })

  const existingPrice = await db
    .select({ price: carsearchPriceHistory.price })
    .from(carsearchPriceHistory)
    .where(eq(carsearchPriceHistory.vin, listing.vin))
    .limit(1)

  if (!existingPrice.length) {
    await db.insert(carsearchPriceHistory).values({
      vin: listing.vin,
      price: listing.price,
      sourceSite: listing.sourceSite,
      observedAt: firstSeenAt
    })
  }
}

console.log(`Seeded ${carsearchSeedListings.length} carsearch listings`)
```

- [ ] **Step 5: Run schema checks**

Run:

```bash
bun typecheck
bun lint
```

Expected: PASS.

- [ ] **Step 6: Apply and seed locally when DB env is available**

Run:

```bash
bun run migrate
bun run scripts/carsearch/seed-carsearch.ts
```

Expected: migrations complete and `Seeded 42 carsearch listings`.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/db/relations.ts drizzle scripts/carsearch/seed-carsearch.ts
git commit -m "feat(carsearch): add listing persistence"
```

## Phase 2 - Public Browse App

### Task 4: Add Server Queries And Auth Gate

**Files:**

- Create: `lib/carsearch/auth.ts`
- Create: `lib/carsearch/queries.ts`
- Create: `lib/carsearch/mutations.ts`
- Create: no direct DB-query unit tests in this task; route and component tests cover these paths after the API/UI layers exist.

- [ ] **Step 1: Add allowed-user helper**

Create `lib/carsearch/auth.ts`:

```ts
export function getAllowedCarsearchUserIds() {
  const configured = process.env.CARSEARCH_ALLOWED_USER_IDS?.split(',')
    .map(id => id.trim())
    .filter(Boolean)

  if (configured?.length) return new Set(configured)

  return new Set(
    [process.env.ADMIN_USER_ID].filter((id): id is string => Boolean(id))
  )
}

export function canManageCarsearch(userId: string | null | undefined) {
  if (!userId) return false
  return getAllowedCarsearchUserIds().has(userId)
}
```

- [ ] **Step 2: Add public listing queries**

Create `lib/carsearch/queries.ts` with these exports:

```ts
import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { getPrivilegedDb } from '@/lib/db/admin'
import {
  carsearchListings,
  carsearchPriceHistory,
  carsearchRefreshRuns,
  carsearchSavedListings
} from '@/lib/db/schema'

export async function listActiveCarsearchListings() {
  return db
    .select()
    .from(carsearchListings)
    .where(eq(carsearchListings.isActive, true))
}

export async function getCarsearchListing(vin: string) {
  const rows = await db
    .select()
    .from(carsearchListings)
    .where(eq(carsearchListings.vin, vin))
    .limit(1)
  return rows[0] ?? null
}

export async function listCarsearchPriceHistory(vin: string) {
  return db
    .select()
    .from(carsearchPriceHistory)
    .where(eq(carsearchPriceHistory.vin, vin))
    .orderBy(desc(carsearchPriceHistory.observedAt))
}

export async function getLatestCarsearchRefreshRun() {
  const rows = await db
    .select()
    .from(carsearchRefreshRuns)
    .orderBy(desc(carsearchRefreshRuns.startedAt))
    .limit(1)
  return rows[0] ?? null
}

export async function listCarsearchSavedListingsForManager(canManage: boolean) {
  if (!canManage) return []
  const privilegedDb = await getPrivilegedDb()
  return privilegedDb.select().from(carsearchSavedListings)
}
```

- [ ] **Step 3: Add mutations**

Create `lib/carsearch/mutations.ts` with privileged writes for saved state:

```ts
import { eq } from 'drizzle-orm'

import { getPrivilegedDb } from '@/lib/db/admin'
import { carsearchSavedListings } from '@/lib/db/schema'

export async function saveCarsearchListing(input: {
  vin: string
  savedByUserId: string
  note?: string | null
}) {
  const db = await getPrivilegedDb()
  const now = new Date()
  await db
    .insert(carsearchSavedListings)
    .values({
      vin: input.vin,
      savedByUserId: input.savedByUserId,
      note: input.note ?? null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: carsearchSavedListings.vin,
      set: {
        savedByUserId: input.savedByUserId,
        note: input.note ?? null,
        updatedAt: now
      }
    })
}

export async function updateCarsearchSavedListing(input: {
  vin: string
  status?: 'saved' | 'contacted' | 'test_drive' | 'rejected' | 'purchased'
  note?: string | null
}) {
  const db = await getPrivilegedDb()
  await db
    .update(carsearchSavedListings)
    .set({
      status: input.status,
      note: input.note,
      updatedAt: new Date()
    })
    .where(eq(carsearchSavedListings.vin, input.vin))
}

export async function unsaveCarsearchListing(vin: string) {
  const db = await getPrivilegedDb()
  await db
    .delete(carsearchSavedListings)
    .where(eq(carsearchSavedListings.vin, vin))
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
bun typecheck
bun lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/carsearch/auth.ts lib/carsearch/queries.ts lib/carsearch/mutations.ts
git commit -m "feat(carsearch): add listing queries and save mutations"
```

### Task 5: Build The Browse Route

**Files:**

- Create: `app/(carsearch)/carsearch/layout.tsx`
- Create: `app/(carsearch)/carsearch/page.tsx`
- Create: `app/(carsearch)/carsearch/loading.tsx`
- Create: `components/carsearch/header.tsx`
- Create: `components/carsearch/filter-bar.tsx`
- Create: `components/carsearch/browse-shell.tsx`
- Create: `components/carsearch/car-card.tsx`
- Create: `components/carsearch/listing-image.tsx`
- Create: `components/carsearch/external-links.tsx`
- Create: `components/carsearch/about-panels.tsx`
- Create: component tests for `car-card` and `browse-shell`

- [ ] **Step 1: Add the route layout**

Create `app/(carsearch)/carsearch/layout.tsx`:

```tsx
export default function CarsearchLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 text-zinc-950">
      {children}
    </main>
  )
}
```

- [ ] **Step 2: Add the server page**

Create `app/(carsearch)/carsearch/page.tsx`:

```tsx
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import {
  getLatestCarsearchRefreshRun,
  listActiveCarsearchListings,
  listCarsearchSavedListingsForManager
} from '@/lib/carsearch/queries'

import { CarsearchBrowseShell } from '@/components/carsearch/browse-shell'

export const dynamic = 'force-dynamic'

export default async function CarsearchPage() {
  const [user, listings, refreshRun] = await Promise.all([
    getCurrentUser(),
    listActiveCarsearchListings(),
    getLatestCarsearchRefreshRun()
  ])
  const canManage = canManageCarsearch(user?.id)
  const savedListings = await listCarsearchSavedListingsForManager(canManage)

  return (
    <CarsearchBrowseShell
      listings={listings}
      savedListings={savedListings}
      canManage={canManage}
      refreshRun={refreshRun}
    />
  )
}
```

- [ ] **Step 3: Implement the component split**

Follow these responsibilities exactly:

- `header.tsx`: title "EV options for your commute", tagline, commute band, Radix dialog using `components/ui/dialog.tsx`.
- `filter-bar.tsx`: brand chips, confirmed-only switch, saved-only switch, sort select. Use real `button`, `Switch` or checkbox, and `Select`; no hover-only controls.
- `browse-shell.tsx`: client component. Holds `filters`, `savedListings`, optimistic save state, and `visibleCount` for load-more. Calls `filterListings`, `sortListings`, and `splitTopPicks`.
- `car-card.tsx`: accepts `{ listing, saved, canManage, onToggleSaved }`. Preserve card anatomy from the static app.
- `listing-image.tsx`: plain image with `onError` state that renders the existing silhouette.
- `external-links.tsx`: port the live Edmunds/Carvana/dealer links from `index.html`.
- `about-panels.tsx`: port the "How we picked these cars", "What to verify", "Home charging", and "Recommended sort" content from `about.html`.

- [ ] **Step 4: Add card rendering tests**

Create `components/carsearch/__tests__/car-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { carsearchSeedListings } from '@/lib/carsearch/seed/snapshot'

import { CarsearchCarCard } from '../car-card'

describe('CarsearchCarCard', () => {
  it('renders preserved plain-language labels and top pick reason', () => {
    const listing = carsearchSeedListings.find(item => item.topPick)!

    render(
      <CarsearchCarCard
        listing={listing}
        saved={false}
        canManage
        onToggleSaved={vi.fn()}
      />
    )

    expect(screen.getByText(/All-wheel drive/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Hands-free driving on highways|Same safety system/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Why we like it/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Add browse behavior tests**

Create `components/carsearch/__tests__/browse-shell.test.tsx` with tests that assert:

- default render hides lemon and unconfirmed/RWD listings,
- changing brand filter narrows the cards,
- changing sort to `price-asc` hides the top-picks section,
- saved-only shows only saved VINs,
- save buttons are disabled or replaced with "Sign in to save" when `canManage=false`.

- [ ] **Step 6: Run tests and checks**

Run:

```bash
bun run test -- components/carsearch lib/carsearch
bun typecheck
bun lint
```

Expected: PASS.

- [ ] **Step 7: Browser verify**

Run:

```bash
bun dev
```

Open `http://localhost:43100/carsearch`. Verify desktop and mobile widths:

- Cards do not overflow at 375px width.
- Filter bar remains usable and does not cover content.
- Top picks show only on recommended sort.
- Images either load or fall back cleanly.
- The route scrolls despite the root `overflow-hidden`.

- [ ] **Step 8: Commit**

```bash
git add app/'(carsearch)' components/carsearch
git commit -m "feat(carsearch): add public browse experience"
```

### Task 6: Build Listing Detail Route

**Files:**

- Create: `app/(carsearch)/carsearch/[vin]/page.tsx`
- Create: `components/carsearch/car-detail.tsx`
- Create: `components/carsearch/saved-controls.tsx`
- Create: tests for detail rendering and saved controls

- [ ] **Step 1: Add the detail server page**

Create `app/(carsearch)/carsearch/[vin]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import {
  getCarsearchListing,
  listCarsearchPriceHistory,
  listCarsearchSavedListingsForManager
} from '@/lib/carsearch/queries'

import { CarsearchCarDetail } from '@/components/carsearch/car-detail'

export const dynamic = 'force-dynamic'

export default async function CarsearchDetailPage({
  params
}: {
  params: Promise<{ vin: string }>
}) {
  const { vin } = await params
  const [user, listing, priceHistory] = await Promise.all([
    getCurrentUser(),
    getCarsearchListing(vin),
    listCarsearchPriceHistory(vin)
  ])

  if (!listing) notFound()

  const canManage = canManageCarsearch(user?.id)
  const savedListings = await listCarsearchSavedListingsForManager(canManage)
  const saved = savedListings.find(item => item.vin === vin) ?? null

  return (
    <CarsearchCarDetail
      listing={listing}
      priceHistory={priceHistory}
      saved={saved}
      canManage={canManage}
    />
  )
}
```

- [ ] **Step 2: Port detail behavior**

`car-detail.tsx` must include:

- Back link to `/carsearch`.
- Image area with top-pick badge.
- "About this car" feature bullets.
- "Why this is one of our top picks" card only for top picks.
- "What to verify before buying" checklist, with the extra driver-assist verification item only when `assist === 'verify'`.
- Price, mileage, range, distance, listed age, source link, map link.
- Price history summary: current price, first observed price, last price change, and a small "No price changes yet" state.
- `SavedControls` for save, status, and note if `canManage`.

- [ ] **Step 3: Implement saved controls**

`saved-controls.tsx` must:

- POST `/api/carsearch/saved` when saving a listing.
- PATCH `/api/carsearch/saved/[vin]` when changing status or note.
- DELETE `/api/carsearch/saved/[vin]` when unsaving.
- Debounce note PATCH by 500ms.
- Show `saved`, `contacted`, `test_drive`, `rejected`, and `purchased` status choices.
- Show a disabled sign-in/permission message when `canManage=false`.

- [ ] **Step 4: Run tests and browser verify**

Run:

```bash
bun run test -- components/carsearch lib/carsearch
bun typecheck
bun lint
```

Open a top-pick detail page and a non-top-pick detail page. Verify status/notes persist after reload for an allowed user.

- [ ] **Step 5: Commit**

```bash
git add app/'(carsearch)' components/carsearch
git commit -m "feat(carsearch): add listing details and shared notes"
```

## Phase 3 - Shared Saves API

### Task 7: Add Authenticated Save API Routes

**Files:**

- Create: `app/api/carsearch/saved/route.ts`
- Create: `app/api/carsearch/saved/[vin]/route.ts`
- Create: `app/api/carsearch/saved/__tests__/route.test.ts`

- [ ] **Step 1: Add create/update route**

Create `app/api/carsearch/saved/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import { saveCarsearchListing } from '@/lib/carsearch/mutations'

const bodySchema = z.object({
  vin: z.string().min(11),
  note: z.string().max(2000).nullable().optional()
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!canManageCarsearch(user?.id)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid-body' },
      { status: 400 }
    )
  }

  await saveCarsearchListing({
    vin: parsed.data.vin,
    note: parsed.data.note ?? null,
    savedByUserId: user!.id
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Add patch/delete route**

Create `app/api/carsearch/saved/[vin]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import {
  unsaveCarsearchListing,
  updateCarsearchSavedListing
} from '@/lib/carsearch/mutations'

const patchSchema = z.object({
  status: z
    .enum(['saved', 'contacted', 'test_drive', 'rejected', 'purchased'])
    .optional(),
  note: z.string().max(2000).nullable().optional()
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vin: string }> }
) {
  const user = await getCurrentUser()
  if (!canManageCarsearch(user?.id)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid-body' },
      { status: 400 }
    )
  }

  const { vin } = await params
  await updateCarsearchSavedListing({ vin, ...parsed.data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ vin: string }> }
) {
  const user = await getCurrentUser()
  if (!canManageCarsearch(user?.id)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { vin } = await params
  await unsaveCarsearchListing(vin)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Add route tests**

Mock `getCurrentUser`, `canManageCarsearch`, and mutation helpers. Tests must cover:

- unauthenticated/unauthorized request returns 403,
- invalid body returns 400,
- POST calls `saveCarsearchListing` with current user ID,
- PATCH calls `updateCarsearchSavedListing`,
- DELETE calls `unsaveCarsearchListing`.

- [ ] **Step 4: Run tests**

Run:

```bash
bun run test -- app/api/carsearch/saved
bun typecheck
bun lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/carsearch/saved
git commit -m "feat(carsearch): add shared save API"
```

## Phase 4 - Refresh Pipeline

### Task 8: Add Edmunds Source Definitions And Parser

**Files:**

- Create: `lib/carsearch/sources.ts`
- Create: `lib/carsearch/parsers/edmunds.ts`
- Create: `lib/carsearch/parsers/__tests__/fixtures/edmunds-mach-e.html`
- Create: `lib/carsearch/parsers/__tests__/edmunds.test.ts`

- [ ] **Step 1: Define sources**

Create `lib/carsearch/sources.ts`:

```ts
export const carsearchSources = [
  {
    sourceSite: 'edmunds' as const,
    label: 'Edmunds - Ford Mustang Mach-E near Dallas',
    url: 'https://www.edmunds.com/used-ford-mustang-mach-e-dallas-tx/?radius=200'
  },
  {
    sourceSite: 'edmunds' as const,
    label: 'Edmunds - Volvo C40 Recharge near Dallas',
    url: 'https://www.edmunds.com/used-volvo-c40-recharge-dallas-tx/?radius=200'
  },
  {
    sourceSite: 'edmunds' as const,
    label: 'Edmunds - Volvo XC40 Recharge near Dallas',
    url: 'https://www.edmunds.com/used-volvo-xc40-recharge-dallas-tx/?radius=200'
  },
  {
    sourceSite: 'edmunds' as const,
    label: 'Edmunds - Polestar 2 near Dallas',
    url: 'https://www.edmunds.com/used-polestar-2-dallas-tx/?radius=200'
  }
]
```

- [ ] **Step 2: Build parser around fixtures first**

`lib/carsearch/parsers/edmunds.ts` must export:

```ts
export type ParsedCarsearchListing = Omit<
  CarsearchListing,
  'topPick' | 'topPickReason' | 'firstSeenAt' | 'lastSeenAt' | 'isActive'
>

export function deriveAssist(input: {
  brand: CarsearchBrand
  year: number
  trim: string
  awd: boolean
}): CarsearchAssist

export function parseEdmundsSearchPage(
  html: string,
  sourceUrl: string
): ParsedCarsearchListing[]
```

Implementation rules:

- Use `parse` from `node-html-parser`.
- Find JSON-LD first if Edmunds exposes inventory data there.
- Fall back to DOM card parsing only after JSON-LD fails.
- Null-check every parsed field. Skip a card if VIN, price, year, model, or source URL is missing.
- Derive `assist` using includes, not exact equality:
  - Volvo `Ultimate` means `std`.
  - Volvo `Plus` or `Core` means `verify`.
  - Ford `Premium` plus AWD means `std`.
  - Ford `GT` year >= 2023 means `std`.
  - Ford `Select` means `verify`.
  - Polestar dual motor means `verify`.
- Keep lemon listings but set `lemon=true` so the UI can hide them and tests can prove the filter.

- [ ] **Step 3: Add parser tests**

Tests must cover `deriveAssist` with these cases:

```ts
expect(
  deriveAssist({ brand: 'volvo', year: 2023, trim: 'Ultimate', awd: true })
).toBe('std')
expect(
  deriveAssist({
    brand: 'volvo',
    year: 2023,
    trim: 'Twin Motor Plus',
    awd: true
  })
).toBe('verify')
expect(
  deriveAssist({
    brand: 'ford',
    year: 2023,
    trim: 'Premium AWD Extended Range',
    awd: true
  })
).toBe('std')
expect(
  deriveAssist({ brand: 'ford', year: 2023, trim: 'GT AWD', awd: true })
).toBe('std')
expect(
  deriveAssist({ brand: 'ford', year: 2025, trim: 'Select', awd: false })
).toBe('verify')
expect(
  deriveAssist({
    brand: 'polestar',
    year: 2023,
    trim: 'Long Range Dual Motor',
    awd: true
  })
).toBe('verify')
```

Fixture test must parse at least one real or saved Edmunds card and assert VIN, price, miles, source URL, image URL, and derived assist.

- [ ] **Step 4: Run tests**

Run:

```bash
bun run test -- lib/carsearch/parsers
bun typecheck
bun lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/carsearch/sources.ts lib/carsearch/parsers
git commit -m "feat(carsearch): parse Edmunds search results"
```

### Task 9: Add Refresh Orchestration And Cron Route

**Files:**

- Create: `lib/carsearch/refresh.ts`
- Create: `app/api/carsearch/refresh/route.ts`
- Modify: `vercel.json`
- Add tests for refresh logic with mocked fetch/parser/db helpers

- [ ] **Step 1: Implement refresh orchestration**

`lib/carsearch/refresh.ts` must:

- Start a `carsearch_refresh_runs` row with `status='running'`.
- Fetch each source with a normal browser-ish user agent.
- Wait 1500-3000ms between source requests.
- Parse listings.
- Preserve existing `topPick` and `topPickReason` on upsert when a VIN already exists.
- Insert a price-history row only when price changed from the current stored listing.
- Mark listings from the same source as inactive if not seen in the run.
- Complete the run with counts or mark failed with the error message.

- [ ] **Step 2: Add cron route**

Create `app/api/carsearch/refresh/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { refreshCarsearchListings } from '@/lib/carsearch/refresh'
import { flushTraces } from '@/lib/utils/telemetry'

export const maxDuration = 60

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'not-configured' },
      { status: 500 }
    )
  }

  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const result = await refreshCarsearchListings()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown'
      },
      { status: 500 }
    )
  } finally {
    await flushTraces()
  }
}
```

- [ ] **Step 3: Add Vercel Cron**

Modify `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/suggestions/refresh",
      "schedule": "0 14 * * *"
    },
    {
      "path": "/api/carsearch/refresh",
      "schedule": "0 12 * * *"
    }
  ]
}
```

`0 12 * * *` is 6am Central during standard time and 7am during daylight time. If exact daylight-time 6am matters, use `0 11 * * *` while Dallas is in CDT.

- [ ] **Step 4: Test unauthorized and successful refresh routes**

Route tests must cover:

- missing `CRON_SECRET` returns 500,
- wrong bearer token returns 401,
- correct token calls `refreshCarsearchListings`,
- refresh errors return 500 and include the error message.

- [ ] **Step 5: Run checks**

Run:

```bash
bun run test -- lib/carsearch app/api/carsearch
bun typecheck
bun lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/carsearch/refresh.ts app/api/carsearch/refresh vercel.json
git commit -m "feat(carsearch): refresh listings from Edmunds"
```

## Phase 5 - Optional Subdomain

### Task 10: Route `carsearch.polymorph.fyi` To The App

**Files:**

- Modify: `proxy.ts`
- Add tests for host rewrite if a proxy test pattern exists

- [ ] **Step 1: Add the domain in Vercel**

In Vercel, attach `carsearch.polymorph.fyi` to the same Polymorph project. No new Vercel project is needed.

- [ ] **Step 2: Add host rewrite**

Only after `/carsearch` is verified, update `proxy.ts` so requests with host `carsearch.polymorph.fyi` and pathname `/` rewrite to `/carsearch`. Preserve existing Supabase session update and `x-request-id` behavior.

Expected behavior:

- `https://polymorph.fyi/carsearch` works.
- `https://carsearch.polymorph.fyi/` serves the same route.
- `https://carsearch.polymorph.fyi/api/...` does not rewrite.
- Static assets and images are not rewritten.

- [ ] **Step 3: Verify in preview first**

Use the Vercel preview URL and host override if possible. Do not point production DNS until the path route has shipped and browser QA has passed.

## Phase 6 - Final Verification

### Task 11: Full Local And Preview Verification

**Files:** none unless bugs are found

- [ ] **Step 1: Run focused tests**

```bash
bun run test -- lib/carsearch components/carsearch app/api/carsearch
```

Expected: PASS.

- [ ] **Step 2: Run repo gates**

```bash
bun lint
bun typecheck
bun run build
```

Expected: PASS. Build runs migrations through `vercel-build` in deployment, but local `bun run build` still needs to compile the route.

- [ ] **Step 3: Run browser QA**

Start:

```bash
bun dev
```

Verify:

- Desktop 1440px: browse page, top picks, filters, detail page, source links.
- Mobile 375px: no text overlap, sticky controls usable, card buttons at least 44px tall.
- Saved state: save, status update, note update, saved-only filter, reload persistence.
- Unauthorized state: public browse works; save UI does not pretend to persist.
- Empty state: filters that remove all cars show a useful message.
- Image fallback: force a broken image URL in dev and confirm silhouette renders.
- Detail page for missing VIN returns not found.

- [ ] **Step 4: Verify refresh manually in a safe environment**

Run against a local or preview environment with `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:43100/api/carsearch/refresh
```

Expected: JSON `{ "ok": true, ... }`, a new refresh run row, listings upserted, and no duplicate price-history rows when prices do not change.

- [ ] **Step 5: Open PR or merge according to user direction**

Before calling complete, report:

- deployed/preview URL,
- whether the route is `/carsearch` only or also subdomain-routed,
- seed count,
- latest refresh run status,
- tests run,
- any source parsing caveats.

## Future Enhancements After MVP

- Add Carvana as a second source and dedupe by VIN.
- Add an admin-only top-pick editor instead of DB/manual seed edits.
- Add compare drawer for 2-3 saved cars.
- Add price-drop/new-listing badges in the card grid.
- Add email digest only after in-app refresh history is trustworthy.
- Add a local zip/distance dataset if source-provided distance becomes unreliable.

## Stop Rules

- Do not add a paid listing API, email provider, hosted scraping service, or new database project without explicit approval.
- Do not broaden this into a generic marketplace. Keep it a personal household car-shopping board.
- Do not bypass gated sites or scrape pages that require login.
- Do not replace the plain-language labels from the static app unless the user asks for copy changes.
- Do not use the chat/canvas layout for this route. It should feel like a focused car-shopping app, not an AI chat surface.
