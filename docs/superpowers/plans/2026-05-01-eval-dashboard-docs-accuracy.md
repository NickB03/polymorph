# Eval Dashboard Documentation Accuracy Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `OVERVIEW.md`, `FILE-INDEX.md`, `API.md`, `DEPLOYMENT.md`, and `.claude/rules/operations.md` back in line with the eval-dashboard code state at HEAD `506674f`, and ship a high-quality visual showcase of the eval dashboard in `README.md`.

**Architecture:** Documentation changes across five files plus a visual-asset phase, grouped into four phases (one commit per phase). Each task verifies the relevant code-side claim against a specific `file:line` before editing the doc, so claims land grounded. Phase D adds screenshots/GIFs of the dashboard and a new README "See it in action" section.

**Tech Stack:** Markdown + MP4/GIF/PNG assets. Read-side: TypeScript (`app/api/evals/run/route.ts`, `lib/db/schema.ts`, `lib/evals/queries.ts`, `services/evals/src/runners/shared.ts`, the `components/evals/` tree). Capture-side: `bun dev` on port 43100; user-recorded `.mp4` source (e.g. QuickTime); `ffmpeg` 8.0.1 (verified at `/opt/homebrew/bin/ffmpeg`) for two-pass palette-based MP4→GIF and frame extraction; `pngquant` 3.0.3 (verified) for poster compression. **Note:** `gifsicle` is **not** installed and is not used — ffmpeg's palette encoding produces better quality at the same filesize. The existing demo fleet (`canvas`/`research`/`geo`) is also a triplet of `<name>.mp4` + `<name>-poster.png` + `<name>.gif`, all 900×526 native.

---

## Background — read first

The last major doc refresh was commit `f7469d2` (PR #156 "docs: refresh architecture and feature references") with polish commits `7eef146` and `e871adb`. Since `e871adb`, the eval dashboard was rewritten:

- **PR #187** (`71ed8a1`) — Migrate `/admin/evals` to redesigned IA. **Deleted** the entire template/widget/layout system: `components/evals/widgets/` directory, `lib/evals/layout/` directory, `lib/evals/helpers/combined-trend.ts`, `lib/actions/eval-preferences.ts`, and the `getEvalsDashboardWithLayout` query. Replaced with `components/evals/dashboard-v2/` (ten files), kept `components/evals/dashboard/` as legacy primitives, and added `components/evals/glossary/`.
- **PR #176** (`9adfe60`) — Render regression suite alongside capability and traffic-monitor in the dashboard.
- **PR #186** (`acd00e8`) — Use production dashboard for mixed demo.
- **PR #167** (`2e91c5a`) — Threshold breaches now warning-only by default; gated by `EVAL_EXIT_ON_THRESHOLD_BREACH`.
- **`f48a329`** — Traffic Monitor replay; passes `userMode`/`intent` through `/api/evals/run` so build-mode traffic stays in build mode on replay.
- **PR #180** (`b07b9c4`) — Already-shipped doc clarification on the eval judge provider; verified still correct, no change needed.

The five docs we're touching describe the _old_ world in several places. Each task below identifies one specific drift and fixes it.

**Out of scope for this plan** — six undocumented eval features the audit identified (judge param logging mechanism, Phoenix feedback/trace correlation, Traffic Monitor replay deep-dive, golden validation, glossary UI behavior, threshold soft-fail prose). These are substantive new content rather than corrections, and writing them requires reading the relevant feature code first. Open a follow-up plan after this one merges.

**Known orphan, flagged but partially deferred** — `lib/db/schema.ts:625-648` still defines the `user_eval_preferences` table and `UserEvalPreference` type, but no production code reads or writes it after PR #187. Task A7 updates the FILE-INDEX schema row so docs no longer imply the table is live; physically dropping the table + type + writing a migration is a separate follow-up.

---

## File Structure

| File                                                                   | Phase | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/OVERVIEW.md`                                        | A     | Lines 50, 51 (adjacent route mention), 88-89 — strip template-switcher / widget tree / `lib/evals/layout/` references; tighten the API-routes mention of evals.                                                                                                                                                                                                                                                                                                             |
| `docs/reference/FILE-INDEX.md`                                         | A     | Line 124 — `/admin/evals` row description. Lines 326-336 — full rewrite of "Evals Dashboard Components" section + add `lib/evals/glossary.ts` row in Evals (app-side). Line 642 — flag `user_eval_preferences` as orphan in schema row (Task A7). Line 658 — delete `lib/actions/eval-preferences.ts` row. Line 799 — drop "+ layout models" framing. Lines 803, 806-807, 808-811, 812 — fix `lib/evals/` rows; mark orphan helpers; add `lib/evals/helpers/alerts.ts` row. |
| `docs/reference/API.md`                                                | B     | Lines 759-779 — add `userMode`, `intent`, `corpusVersion` to `/api/evals/run` schema. Verify both runner spread (`traffic-monitor.ts:51-52`) and sampler derivation (`sampler.ts:551`).                                                                                                                                                                                                                                                                                     |
| `docs/operations/DEPLOYMENT.md`                                        | C     | Line 169 — evaluator count (5→7 with deterministic split). Line 170 — schema citation `:558-560` → `:560-563`.                                                                                                                                                                                                                                                                                                                                                              |
| `.claude/rules/operations.md`                                          | C     | Line 11 — dashboard description (singular "Traffic Monitor section" → three suites). Line 13 — file list (add runners directory).                                                                                                                                                                                                                                                                                                                                           |
| `README.md` + `docs/assets/demos/evals.{mp4,gif}` + `evals-poster.png` | D     | Embed eval-dashboard demo triplet matching the existing canvas/research/geo pattern (900×526 native, ~2 MB GIF). User records the source mp4; agent does ffmpeg conversion + README integration.                                                                                                                                                                                                                                                                            |

---

## Phase A — IA Cleanup (mechanical doc fixes from PR #187)

### Task A1: Fix `OVERVIEW.md:50` template-driven dashboard claim

**Files:**

- Modify: `docs/architecture/OVERVIEW.md:50`

- [ ] **Step 1: Verify code state**

Open `app/(admin)/admin/evals/page.tsx` and confirm it calls `getEvalsDashboard(user.id)` and renders `EvalsDashboardV2` with no template-switcher and no layout-preference read.

```bash
cat "app/(admin)/admin/evals/page.tsx"
```

Expected: `import { getEvalsDashboard }` (not `getEvalsDashboardWithLayout`), no reference to `setPreferredEvalsLayout` or `userEvalPreferences`.

- [ ] **Step 2: Verify the doc claim is wrong**

Read line 50 of `docs/architecture/OVERVIEW.md`. The current text:

```
- `app/(admin)/` — admin surface gated by `ADMIN_USER_ID` (see `lib/auth/is-admin.ts`): currently `/admin/evals` (template-driven evals dashboard with persisted layout preference).
```

- [ ] **Step 3: Replace with the new IA description**

Edit `docs/architecture/OVERVIEW.md:50`:

`old_string`:

```
- `app/(admin)/` — admin surface gated by `ADMIN_USER_ID` (see `lib/auth/is-admin.ts`): currently `/admin/evals` (template-driven evals dashboard with persisted layout preference).
```

`new_string`:

```
- `app/(admin)/` — admin surface gated by `ADMIN_USER_ID` (see `lib/auth/is-admin.ts`): currently `/admin/evals` (two-view evals dashboard — "Suites" and "Run history" — with per-suite drilldown; URL state via `?view=suites|history` and `?suite=capability|trafficMonitor|regression`).
```

### Task A1b: Fix `OVERVIEW.md:51` adjacent "evals" route mention

**Files:**

- Modify: `docs/architecture/OVERVIEW.md:51`

A1 fixes line 50; line 51 has the same drift class — "API routes, including chat, suggestions … evals" lists `evals` as a generic group, but `/api/evals/run` is the only route there and it's secret-gated, not user-facing.

- [ ] **Step 1: Read the current line**

```bash
sed -n '51p' docs/architecture/OVERVIEW.md
```

- [ ] **Step 2: Verify there's only one evals route**

```bash
ls app/api/evals/
```

Expected: only `run/` (and possibly a co-located test). If others exist, adjust the new wording.

- [ ] **Step 3: Edit line 51**

`old_string`:

```
- `app/api/` — API routes, including chat, suggestions (+ `refresh` Vercel cron endpoint), evals, uploads, voice synthesis, canvas artifacts, and canvas asset proxying.
```

`new_string`:

```
- `app/api/` — API routes, including chat, suggestions (+ `refresh` Vercel cron endpoint), the secret-gated `evals/run` replay endpoint, uploads, voice synthesis, canvas artifacts, and canvas asset proxying.
```

### Task A2: Fix `OVERVIEW.md:88-89` key-files table

**Files:**

- Modify: `docs/architecture/OVERVIEW.md:88-89`

- [ ] **Step 1: Verify the deletions**

```bash
ls components/evals/widgets/ 2>&1
ls lib/evals/layout/ 2>&1
```

Expected: both return "No such file or directory."

- [ ] **Step 2: Confirm the new top-level orchestrator**

```bash
ls components/evals/dashboard-v2/dashboard.tsx
```

Expected: file exists.

- [ ] **Step 3: Replace the two table rows**

Edit `docs/architecture/OVERVIEW.md`:

`old_string`:

```
| Evals dashboard          | [`components/evals/dashboard-v2/dashboard.tsx`](../../components/evals/dashboard-v2/dashboard.tsx) + widget tree at `components/evals/widgets/` |
| Evals layout templates   | [`lib/evals/layout/templates.ts`](../../lib/evals/layout/templates.ts)                                                                          |
```

`new_string`:

```
| Evals dashboard          | [`components/evals/dashboard-v2/dashboard.tsx`](../../components/evals/dashboard-v2/dashboard.tsx) (orchestrator) + sibling components in `components/evals/dashboard-v2/` and `components/evals/glossary/` |
| Evals queries            | [`lib/evals/queries.ts`](../../lib/evals/queries.ts) (`getEvalsDashboard`, suite-specific selectors)                                            |
```

### Task A3: Fix `FILE-INDEX.md:124` `/admin/evals` row

**Files:**

- Modify: `docs/reference/FILE-INDEX.md:124`

- [ ] **Step 1: Verify the current text is wrong**

Re-read `app/(admin)/admin/evals/page.tsx` (already done in A1). The page is no longer template-switcher-driven.

- [ ] **Step 2: Edit the row**

Edit `docs/reference/FILE-INDEX.md`:

`old_string`:

```
| `app/(admin)/admin/evals/page.tsx`    | `/admin/evals` | Evals dashboard v2 — template-switcher + widget layouts, persisted layout preference                                                                |
```

`new_string`:

```
| `app/(admin)/admin/evals/page.tsx`    | `/admin/evals` | Evals dashboard v2 — "Suites" and "Run history" views with per-suite drilldown; URL state via `?view=` and `?suite=`; evaluator breakdown and comparison panels |
```

### Task A4: Rewrite `FILE-INDEX.md` "Evals Dashboard Components" section

**Files:**

- Modify: `docs/reference/FILE-INDEX.md:326-336`

This task replaces a stale 7-row table with a structured description of the three sibling directories (`dashboard-v2/`, `dashboard/`, `glossary/`).

- [ ] **Step 1: Inventory the actual tree**

```bash
ls components/evals/dashboard-v2/ components/evals/dashboard/ components/evals/glossary/
```

Confirm output matches the table you'll write. The expected files (test files excluded for the doc table):

- `dashboard-v2/`: `dashboard.tsx`, `view-switcher.tsx`, `suite-selector.tsx`, `evaluator-breakdown.tsx`, `collapsible-comparison.tsx`, `compact-alert.tsx`, `auto-badge.tsx`, `url-state.ts`, `use-url-state.ts`, `local-labels.ts`
- `dashboard/`: `activity-list.tsx`, `comparison-table.tsx`, `score-bar.tsx`, `score-feature.tsx`, `shared.ts`
- `glossary/`: `aggregate-breakdown.tsx`, `defined-term.tsx`, `judge-label.tsx`, `score-cell.tsx`, `index.ts`

- [ ] **Step 2: Spot-check each `dashboard-v2/` component's role**

Open each of the ten `dashboard-v2/` files (excluding tests) and skim the top-level export and any JSDoc/comment to confirm the role you'll write. This is critical — the implementer writing this section MUST read each file rather than copy the table below verbatim, because component intent is the kind of thing that decays.

```bash
head -30 components/evals/dashboard-v2/dashboard.tsx
head -30 components/evals/dashboard-v2/view-switcher.tsx
# ...repeat for each
```

- [ ] **Step 3: Replace the section**

Edit `docs/reference/FILE-INDEX.md`. Use the table below as a starting draft; **revise each Purpose cell to match what the file actually does** based on Step 2.

`old_string`:

```
### Evals Dashboard Components

| File                                                  | Purpose                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/evals/dashboard-v2/dashboard.tsx`         | Top-level evals dashboard: loads suite data + user layout preference, renders via `LayoutRenderer`                                                     |
| `components/evals/dashboard-v2/template-switcher.tsx` | Template switcher control; persists the user's preferred layout via `setPreferredEvalsLayout`                                                          |
| `components/evals/dashboard-v2/dashboard.test.tsx`    | Tests for dashboard template selection, widget rendering, and layout persistence                                                                       |
| `components/evals/widgets/layout-renderer.tsx`        | Renders widgets from a layout template definition against loaded suite data                                                                            |
| `components/evals/widgets/registry.ts`                | Widget registry mapping widget type names to React components + prop adapters                                                                          |
| `components/evals/widgets/*.tsx`                      | Individual widget components (KPI tiles, score rings, trend charts, evaluator bars/grids, activity feed, etc.) — see `registry.ts` for the active list |
| `components/evals/widgets/shared/`                    | Shared widget utilities: formatters, sparkline, prop types                                                                                             |
```

`new_string`:

```
### Evals Dashboard Components

The dashboard tree has three sibling directories: `dashboard-v2/` (current IA — Suites/History with per-suite drilldown), `dashboard/` (legacy primitives reused by v2), and `glossary/` (term-rendering helpers used in tooltips and label cells).

| File                                                       | Purpose                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `components/evals/dashboard-v2/dashboard.tsx`              | Top-level orchestrator: handles the empty-state branch, owns the `TooltipProvider` wrap and CSS-driven enter animations, routes Suites/History via `?view=`, drills into a chosen suite via `?suite=`, and composes `EvaluatorBreakdown`, `CollapsibleComparison`, `CompactAlert`, plus legacy primitives `ActivityList`/`ScoreFeature` from `components/evals/dashboard/` |
| `components/evals/dashboard-v2/view-switcher.tsx`          | URL-state-driven `radiogroup` switcher between "Suites" (`?view=suites`) and "Run history" (`?view=history`)                             |
| `components/evals/dashboard-v2/suite-selector.tsx`         | ARIA `tablist` for the per-suite drilldown. **Renames the suites for display:** `capability` → "Benchmarks", `trafficMonitor` → "Live traffic", `regression` → "Pinned checks" |
| `components/evals/dashboard-v2/evaluator-breakdown.tsx`    | Per-evaluator score breakdown for a suite run; renders `AutoBadge` next to deterministic evaluators (`deterministic_prechecks`, `tool_usage`) |
| `components/evals/dashboard-v2/collapsible-comparison.tsx` | Comparison panel between latest and prior runs (collapsible)                                                                             |
| `components/evals/dashboard-v2/compact-alert.tsx`          | Compact alert banner for threshold-breach state, sourced from `lib/evals/helpers/alerts.ts:getLatestThresholdAlert`                      |
| `components/evals/dashboard-v2/auto-badge.tsx`             | Static "auto" pill marking **deterministic** evaluator rows (e.g. `deterministic_prechecks`, `tool_usage`) so readers can distinguish them from LLM-judge rows in `EvaluatorBreakdown` |
| `components/evals/dashboard-v2/url-state.ts`               | Pure parse/serialize helpers + type guards (`isView`, `isSuiteId`) for the `?view=` and `?suite=` params                                 |
| `components/evals/dashboard-v2/use-url-state.ts`           | React hook wrapping `url-state.ts` for component-level reactive URL state                                                                |
| `components/evals/dashboard-v2/local-labels.ts`            | Local display-label overrides for the dashboard-v2 surface — exists specifically because the full evaluator name "Deterministic Prechecks" overflows the 2-column row |
| `components/evals/dashboard/activity-list.tsx`             | Legacy: recent runs activity list (still imported by dashboard-v2)                                                                       |
| `components/evals/dashboard/comparison-table.tsx`          | Legacy: tabular comparison primitive (still imported by dashboard-v2)                                                                    |
| `components/evals/dashboard/score-bar.tsx`                 | Legacy: horizontal pass-rate bar primitive                                                                                               |
| `components/evals/dashboard/score-feature.tsx`             | Legacy: score-with-label feature primitive                                                                                               |
| `components/evals/dashboard/shared.ts`                     | Legacy: shared formatters and types used by dashboard primitives                                                                         |
| `components/evals/glossary/defined-term.tsx`               | Inline term with hover-popover definition                                                                                                |
| `components/evals/glossary/judge-label.tsx`                | Stylized rendering of LLM-judge verdict labels                                                                                           |
| `components/evals/glossary/score-cell.tsx`                 | Score cell with embedded glossary tooltip                                                                                                |
| `components/evals/glossary/aggregate-breakdown.tsx`        | Aggregate-score breakdown component for evaluator clusters                                                                               |

> **Note on test files:** the `dashboard-v2/`, `dashboard/`, and `glossary/` directories contain co-located `*.test.tsx` files (six in `dashboard-v2/` alone). They are **intentionally omitted** from this section — FILE-INDEX is selectively detailed and other component sections (e.g. `tool-ui/`) follow the same convention. Do not add them back.
```

- [ ] **Step 4: After editing, re-read the section and confirm every `Purpose` cell matches what you saw in the file.** Fix any drift.

- [ ] **Step 5: Add the missing `lib/evals/glossary.ts` row in the Evals (app-side) section**

The `dashboard-v2/glossary/` UI imports from a sibling `lib/evals/glossary.ts` data module that is currently absent from `FILE-INDEX.md`. Confirm it exists:

```bash
ls lib/evals/glossary.ts
grep -n "from.*lib/evals/glossary'" components/evals/dashboard-v2/evaluator-breakdown.tsx
```

Expected: file exists and is imported by `evaluator-breakdown.tsx:3`. Then edit `docs/reference/FILE-INDEX.md`:

`old_string`:

```
| `lib/evals/evaluator-labels.ts`       | Human-readable labels for evaluator IDs                                                                   |
```

`new_string`:

```
| `lib/evals/evaluator-labels.ts`       | Human-readable labels for evaluator IDs                                                                   |
| `lib/evals/glossary.ts`               | Term definitions powering the `components/evals/glossary/` tooltip and label-rendering helpers            |
```

### Task A5: Delete `FILE-INDEX.md:658` stale eval-preferences row

**Files:**

- Modify: `docs/reference/FILE-INDEX.md:658`

- [ ] **Step 1: Verify the file is gone**

```bash
ls lib/actions/eval-preferences.ts 2>&1
```

Expected: "No such file or directory."

- [ ] **Step 2: Delete the row**

Edit `docs/reference/FILE-INDEX.md`:

`old_string`:

```
| `lib/actions/site-feedback.ts`    | Server action to submit site-wide user feedback (sentiment + message)                                  |
| `lib/actions/eval-preferences.ts` | Server action persisting a user's preferred evals dashboard layout (writes to `user_eval_preferences`) |
```

`new_string`:

```
| `lib/actions/site-feedback.ts`    | Server action to submit site-wide user feedback (sentiment + message)                                  |
```

### Task A6: Fix `FILE-INDEX.md` `lib/evals/` rows

**Files:**

- Modify: `docs/reference/FILE-INDEX.md:803, 806-807, 812`

- [ ] **Step 1: Verify the export name**

```bash
grep -n "export async function getEvalsDashboard" lib/evals/queries.ts
```

Expected: one match at line 158, `export async function getEvalsDashboard(`. Confirm there is no `getEvalsDashboardWithLayout`:

```bash
grep -n "getEvalsDashboardWithLayout" lib/evals/queries.ts
```

Expected: no matches.

- [ ] **Step 2: Verify deleted files**

```bash
ls lib/evals/layout/ 2>&1
ls lib/evals/helpers/combined-trend.ts 2>&1
```

Expected: both "No such file or directory."

- [ ] **Step 3: Confirm what `queries.ts` actually queries**

```bash
grep -n "from(.*)\|join(" lib/evals/queries.ts
```

Expected: only `eval_summaries`-derived queries (no `userEvalPreferences` joins).

- [ ] **Step 3b: Fix the section-header framing at `FILE-INDEX.md:799`**

The section header still says "Data access + layout models" but the layout system was deleted. Edit `docs/reference/FILE-INDEX.md`:

`old_string`:

```
Data access + layout models backing the admin `/admin/evals` dashboard. The offline cron that _writes_ these rows lives under `services/evals/`.
```

`new_string`:

```
Data access and view helpers backing the admin `/admin/evals` dashboard. The offline cron that _writes_ these rows lives under `services/evals/`.
```

- [ ] **Step 4: Edit row 803**

`old_string`:

```
| `lib/evals/queries.ts`                | Server-side queries over `eval_summaries` + `user_eval_preferences` (incl. `getEvalsDashboardWithLayout`) |
```

`new_string`:

```
| `lib/evals/queries.ts`                | Server-side queries over `eval_summaries` (`getEvalsDashboard`, capability/regression/traffic-monitor selectors)                  |
```

- [ ] **Step 5: Delete rows 806, 807, 812**

`old_string`:

```
| `lib/evals/layout/templates.ts`       | Dashboard layout templates (A/B/C) — widget composition and data selectors                                |
| `lib/evals/layout/types.ts`           | Type definitions for layout templates and widget configuration                                            |
| `lib/evals/helpers/health-state.ts`   | Derives overall suite health state (healthy/watch/regression) from recent runs                            |
```

`new_string`:

```
| `lib/evals/helpers/health-state.ts`   | Derives overall suite health state (healthy/watch/regression) from recent runs                            |
```

Then for the `combined-trend.ts` row, replace it (and add a new `alerts.ts` row that the prior table omitted):

`old_string`:

```
| `lib/evals/helpers/findings.ts`       | Extracts ranked findings/narratives from eval summaries                                                   |
| `lib/evals/helpers/combined-trend.ts` | Prepares combined-trend chart series across multiple suites                                               |
```

`new_string`:

```
| `lib/evals/helpers/findings.ts`       | Extracts ranked findings/narratives from eval summaries                                                   |
| `lib/evals/helpers/alerts.ts`         | Builds dashboard alert payloads from threshold-breached snapshots; defines `DashboardAlert` shape         |
```

- [ ] **Step 6: Verify `alerts.ts` exists and is wired into the dashboard**

```bash
ls lib/evals/helpers/alerts.ts
grep -n "from.*helpers/alerts\|DashboardAlert" components/evals/dashboard-v2/dashboard.tsx components/evals/dashboard-v2/compact-alert.tsx 2>&1 | head
```

Expected: `alerts.ts` exists and `compact-alert.tsx` imports `getLatestThresholdAlert` from it.

- [ ] **Step 7: Audit the remaining `lib/evals/helpers/*` rows for orphans**

PR #187 deleted the widget tree but left several `helpers/` files that those widgets used. Re-grep each surviving helper for **live** consumers (excluding `lib/evals/helpers/` itself, where they may cross-import):

```bash
for helper in divergences feed findings health-state; do
  echo "=== $helper ==="
  grep -rn "from.*helpers/$helper\b" \
    components/ app/ services/ \
    lib/ --include="*.ts" --include="*.tsx" \
    --exclude-dir="helpers" 2>&1 | head -5
done
```

Expected: `findings.ts` may have a consumer (it imports `alerts.ts`); the other three (`divergences.ts`, `feed.ts`, `health-state.ts`) likely have **no live consumers** outside `helpers/` itself. The file `feed.ts:4` self-describes as feeding the deleted `activity-feed` widget — it's dead code.

Apply one of two strategies based on what the grep returns:

**Strategy A (preferred — same treatment as A7's orphan table):** keep the rows in FILE-INDEX but add `(orphan — no live consumers, scheduled for removal)` to each Purpose cell. Code stays put for now.

**Strategy B (drop both code and rows):** delete the orphan helpers and their FILE-INDEX rows in one motion. Only choose this if the grep is conclusive AND you're prepared to run `bun typecheck` + `bun test` to confirm nothing breaks.

Default to Strategy A; only switch to B if the user explicitly authorizes.

For Strategy A, edit each row in `FILE-INDEX.md`:

`old_string`:

```
| `lib/evals/helpers/health-state.ts`   | Derives overall suite health state (healthy/watch/regression) from recent runs                            |
| `lib/evals/helpers/divergences.ts`    | Computes notable evaluator-level divergences between runs                                                 |
| `lib/evals/helpers/feed.ts`           | Builds the activity-feed widget data from recent eval runs                                                |
```

`new_string`:

```
| `lib/evals/helpers/health-state.ts`   | (orphan — no live consumers after PR #187; scheduled for removal) Derives overall suite health state from recent runs |
| `lib/evals/helpers/divergences.ts`    | (orphan — no live consumers after PR #187; scheduled for removal) Computes notable evaluator-level divergences between runs |
| `lib/evals/helpers/feed.ts`           | (orphan — no live consumers after PR #187; built the deleted `activity-feed` widget) Activity-feed data builder |
```

Adjust if your grep finds an unexpected consumer for any of these.

### Task A7: Mark `user_eval_preferences` as orphan in FILE-INDEX schema row

**Files:**

- Modify: `docs/reference/FILE-INDEX.md:642`

The plan's `eval-preferences.ts` deletion (A5) and `getEvalsDashboardWithLayout` removal (A6) leave `user_eval_preferences` as an orphan table — defined in `lib/db/schema.ts:625-648` but never read or written by live code. Until a follow-up plan physically drops the table, the FILE-INDEX schema row should not list it alongside live tables without qualification.

- [ ] **Step 1: Confirm there are no live consumers**

```bash
grep -rn "userEvalPreferences\|user_eval_preferences" lib/ app/ components/ services/ 2>&1
```

Expected: matches **only** in `lib/db/schema.ts` itself (the table definition, the `UserEvalPreference` type export, and any internal references within the schema file). If matches appear in `app/`, `components/`, `services/`, or anywhere else under `lib/` outside `schema.ts`, **stop** — the table has live consumers and this task should be skipped.

- [ ] **Step 2: Edit the schema row**

Edit `docs/reference/FILE-INDEX.md`:

`old_string`:

```
| `lib/db/schema.ts`    | Drizzle schema defining `chats`, `messages`, `parts`, `feedback`, `canvas_artifacts`, `eval_summaries`, `user_eval_preferences`, and `trending_suggestions_cache` with RLS policies |
```

`new_string`:

```
| `lib/db/schema.ts`    | Drizzle schema defining `chats`, `messages`, `parts`, `feedback`, `canvas_artifacts`, `eval_summaries`, and `trending_suggestions_cache` with RLS policies. Also still declares an orphan `user_eval_preferences` table left over from PR #187 — no live consumers; scheduled for removal in a follow-up |
```

### Task A8: Verify and commit Phase A

- [ ] **Step 1: Re-read all six edited locations**

Open `docs/architecture/OVERVIEW.md` (lines 45-95) and `docs/reference/FILE-INDEX.md` (lines 115-140, 320-360, 635-665, 795-815). Skim for stragglers — any remaining mention of `template-switcher`, `widgets/`, `layout/templates`, `eval-preferences`, `getEvalsDashboardWithLayout`, or unflagged mentions of `user_eval_preferences`.

```bash
grep -n "template-switcher\|widgets/\|layout/templates\|eval-preferences\|getEvalsDashboardWithLayout" docs/architecture/OVERVIEW.md docs/reference/FILE-INDEX.md
```

Expected: no matches. Then verify A7 landed:

```bash
grep -n "user_eval_preferences" docs/reference/FILE-INDEX.md
```

Expected: exactly one match (the schema row, with the "orphan" qualification). If multiple matches or an unqualified mention, fix before committing.

- [ ] **Step 2: Run docs-only checks (no test suite to run)**

```bash
bun lint docs/ 2>&1 || true
bun format:check docs/architecture/OVERVIEW.md docs/reference/FILE-INDEX.md
```

If `format:check` fails, run `bun format docs/architecture/OVERVIEW.md docs/reference/FILE-INDEX.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/OVERVIEW.md docs/reference/FILE-INDEX.md
git commit -m "$(cat <<'EOF'
docs(evals): remove stale template-switcher and widget references

PR #187 deleted components/evals/widgets/, lib/evals/layout/, and
lib/actions/eval-preferences.ts but the docs still pointed at them.
Update OVERVIEW.md and FILE-INDEX.md to describe the new dashboard-v2
+ glossary tree and the getEvalsDashboard query. Also add the
previously-undocumented lib/evals/helpers/alerts.ts row, and qualify
the schema row to flag user_eval_preferences as an orphan table left
over from PR #187 (no live consumers; scheduled for removal).
EOF
)"
```

---

## Phase B — API Contract (`/api/evals/run`)

### Task B1: Verify the route schema

**Files:**

- Read: `app/api/evals/run/route.ts:7-26`

- [ ] **Step 1: Read the schema**

```bash
sed -n '7,26p' app/api/evals/run/route.ts
```

Expected: a Zod schema with required `caseId`, `suite`, `conversation`, `searchMode`, `modelType` AND **optional** `userMode` (`'search' | 'research' | 'build'`), `intent` (string), `corpusVersion` (string).

- [ ] **Step 2: Confirm replay use of these fields**

The runner forwards what the sampler computed — the **derivation** of `intent` lives in the sampler, not the runner. Verify both ends:

```bash
# Sampler — where intent is derived from userMode for build-mode chats:
grep -n "intent\s*=\|sample.intent\|sample.userMode" services/evals/src/sampler.ts | head -10

# Runner — where the precomputed fields are spread into the request body:
grep -n "userMode\|intent\|corpusVersion" services/evals/src/runners/traffic-monitor.ts
```

Expected:

- `sampler.ts` around line 551 contains a derivation along the lines of `intent = rawUserMode === 'build' ? 'build' : rawIntent`. (Originally at line 535; PR #189 added a 16-line SQL filter at `:143` which pushed this down.)
- `traffic-monitor.ts` around line 51-52 spreads `sample.userMode` and `sample.intent` into the `/api/evals/run` request body when present.

This split matters for the API.md prose: the route accepts any string, the **sampler** is what guarantees `'build'` on build-mode replays.

### Task B2: Update `API.md` `/api/evals/run` schema

**Files:**

- Modify: `docs/reference/API.md:759-779`

- [ ] **Step 1: Edit the TypeScript block**

Edit `docs/reference/API.md`:

`old_string`:

```
{
  caseId: string // Unique identifier for the eval case
  suite: 'capability' | 'regression' | 'smoke' | 'traffic-monitor'
  conversation: Array<{
    // Message history to replay
    role: 'user' | 'assistant'
    parts: Array<{ type: 'text'; text: string }>
  }>
  searchMode: 'chat' | 'research'
  modelType: 'speed' | 'quality'
}
```

`new_string`:

```
{
  caseId: string // Unique identifier for the eval case
  suite: 'capability' | 'regression' | 'smoke' | 'traffic-monitor'
  conversation: Array<{
    // Message history to replay
    role: 'user' | 'assistant'
    parts: Array<{ type: 'text'; text: string }>
  }>
  searchMode: 'chat' | 'research'
  modelType: 'speed' | 'quality'
  userMode?: 'search' | 'research' | 'build' // Optional; carries the original UI mode through replay
  intent?: string // Optional; carried from the source chat. The traffic-monitor runner forwards this so build-mode replays preserve `'build'`. Validated as z.string().optional() — the route does not enforce a specific value.
  corpusVersion?: string // Optional; pins the eval against a specific golden-corpus revision
}
```

- [ ] **Step 2: Edit the field table**

`old_string`:

```
| Field          | Type     | Required | Description                                                            |
| -------------- | -------- | -------- | ---------------------------------------------------------------------- |
| `caseId`       | `string` | Yes      | Identifier for the evaluation case.                                    |
| `suite`        | `string` | Yes      | Eval suite: `capability`, `regression`, `smoke`, or `traffic-monitor`. |
| `conversation` | `array`  | Yes      | Message array with `role` and `parts` for each message.                |
| `searchMode`   | `string` | Yes      | Agent mode: `chat` or `research`.                                      |
| `modelType`    | `string` | Yes      | Model tier: `speed` or `quality`.                                      |
```

`new_string`:

```
| Field           | Type     | Required | Description                                                                                       |
| --------------- | -------- | -------- | ------------------------------------------------------------------------------------------------- |
| `caseId`        | `string` | Yes      | Identifier for the evaluation case.                                                               |
| `suite`         | `string` | Yes      | Eval suite: `capability`, `regression`, `smoke`, or `traffic-monitor`.                            |
| `conversation`  | `array`  | Yes      | Message array with `role` and `parts` for each message.                                           |
| `searchMode`    | `string` | Yes      | Agent mode: `chat` or `research`.                                                                 |
| `modelType`     | `string` | Yes      | Model tier: `speed` or `quality`.                                                                 |
| `userMode`      | `string` | No       | Original UI mode (`search`, `research`, or `build`). Required for faithful traffic-monitor replay of `build`-mode chats. |
| `intent`        | `string` | No       | Carried through from the source chat's `intent`. The traffic-monitor runner forwards this so build-mode replays preserve `'build'`. Validated as any string — the route does not enforce a specific value. |
| `corpusVersion` | `string` | No       | Pins the eval against a specific golden-corpus revision; omit to use the runner's current corpus. |
```

### Task B3: Verify and commit Phase B

- [ ] **Step 1: Re-read the edited block**

Open `docs/reference/API.md` lines 750-800 and confirm both blocks match the route's Zod schema field-for-field.

- [ ] **Step 2: Format check**

```bash
bun format:check docs/reference/API.md
```

If it fails, run `bun format docs/reference/API.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/reference/API.md
git commit -m "$(cat <<'EOF'
docs(api): document optional userMode, intent, corpusVersion on /api/evals/run

The route schema (app/api/evals/run/route.ts:7-26) accepts three
additional optional fields used by traffic-monitor replay (f48a329).
userMode is required to faithfully replay build-mode traffic.
EOF
)"
```

---

## Phase C — Operator Doc Citations and Framing

### Task C1: Fix `DEPLOYMENT.md:169` evaluator count

**Files:**

- Modify: `docs/operations/DEPLOYMENT.md:169`

- [ ] **Step 1: Verify the count**

```bash
ls services/evals/src/evaluators/ | grep -v test
grep -n "prechecks\|tool-usage\|faithfulness\|relevance\|response-quality\|safety\|citation-accuracy" services/evals/src/runners/traffic-monitor.ts | head
```

Expected: `services/evals/src/evaluators/` contains 6 files — 5 LLM-judge (`citation-accuracy`, `faithfulness`, `relevance`, `response-quality`, `safety`) and 1 deterministic (`tool-usage`). The other deterministic evaluator, `prechecks`, lives at `services/evals/src/prechecks.ts` (sibling of `evaluators/`, not inside it). Total: 5 LLM-judge + 2 deterministic = 7. `.claude/rules/operations.md:10` confirms.

- [ ] **Step 2: Edit line 169**

Edit `docs/operations/DEPLOYMENT.md`:

`old_string`:

```
- Runs 5 LLM-judge evaluators (faithfulness, relevance, response quality, safety, citation accuracy) built with a shared factory pattern and `extractVerdict()` with word-boundary matching
```

`new_string`:

```
- Runs 7 evaluators: 2 deterministic (`prechecks`, `tool-usage`) + 5 LLM-judge (faithfulness, relevance, response-quality, safety, citation-accuracy) built with a shared factory pattern and `extractVerdict()` with word-boundary matching
```

### Task C2: Fix `DEPLOYMENT.md:170` schema citation

**Files:**

- Modify: `docs/operations/DEPLOYMENT.md:170`

- [ ] **Step 1: Verify the correct line**

```bash
sed -n '558,565p' lib/db/schema.ts
```

Expected: line 558 is `export type Feedback`, lines 560-563 are the comment block "Note: Only SELECT RLS policy ...", line 564 is `export const evalSummaries`. The doc currently cites `:558-560` which lands one line short of the real comment.

- [ ] **Step 2: Edit line 170**

Edit `docs/operations/DEPLOYMENT.md`:

`old_string`:

```
- Pushes results to Phoenix as experiments **and** persists eval summaries to the `eval_summaries` Postgres table, which powers the admin `/admin/evals` dashboard (capability, regression, and Traffic Monitor sections). After the next cron firing, operators should see fresh rows on the dashboard; if they don't, suspect the sampler's DB role missing the RLS context for write paths (see `lib/db/schema.ts:558-560` and the live Railway `DATABASE_URL` role).
```

`new_string`:

```
- Pushes results to Phoenix as experiments **and** persists eval summaries to the `eval_summaries` Postgres table, which powers the admin `/admin/evals` dashboard (capability, regression, and traffic-monitor suites). After the next cron firing, operators should see fresh rows on the dashboard; if they don't, suspect the sampler's DB role missing the RLS context for write paths (see `lib/db/schema.ts:560-563` for the policy note and the live Railway `DATABASE_URL` role).
```

### Task C3: Update `operations.md:11` dashboard description

**Files:**

- Modify: `.claude/rules/operations.md:11`

- [ ] **Step 1: Verify all three suites are first-class**

```bash
grep -n "capability\|regression\|trafficMonitor" lib/evals/queries.ts | head
```

Expected: `getEvalsDashboard` returns `{ capability, regression, trafficMonitor, recentRuns }` — three peer suites, not "traffic monitor as a section."

- [ ] **Step 2: Edit line 11**

Edit `.claude/rules/operations.md`:

`old_string`:

```
- Pushes results to Phoenix as experiments **and** persists eval summaries to the `eval_summaries` Postgres table, which powers the admin `/evals` dashboard (including the Traffic Monitor section)
```

`new_string`:

```
- Pushes results to Phoenix as experiments **and** persists eval summaries to the `eval_summaries` Postgres table, which powers the admin `/admin/evals` dashboard across three peer suites (capability, regression, traffic-monitor)
```

Note both fixes in this single edit: `/evals` → `/admin/evals` (the route gate is `/admin/evals`; `/evals` 404s) and the suite framing change.

### Task C4: Update `operations.md:13` file list

**Files:**

- Modify: `.claude/rules/operations.md:13`

- [ ] **Step 1: Verify where the failure-label log lines actually live now**

```bash
grep -n "PHOENIX UNAVAILABLE\|DB WRITE FAILED" services/evals/src/runners/shared.ts
```

Expected: matches at lines 141 and 202 in `services/evals/src/runners/shared.ts`. Confirm `services/evals/src/orchestrator.ts` and the four suite runners exist:

```bash
ls services/evals/src/orchestrator.ts services/evals/src/runners/{capability,regression,smoke,traffic-monitor,shared}.ts
```

Expected: all six files exist.

- [ ] **Step 2: Edit line 13**

Edit `.claude/rules/operations.md`:

`old_string`:

```
- Key files: `sampler.ts`, `prechecks.ts`, `config.ts`, `evaluators/faithfulness.ts`, `evaluators/relevance.ts`, `evaluators/response-quality.ts`, `evaluators/safety.ts`, `evaluators/citation-accuracy.ts`, `evaluators/tool-usage.ts`
```

`new_string`:

```
- Key files: `orchestrator.ts` (suite dispatch), `runners/shared.ts` (Phoenix experiment + DB-write helper; emits the two failure labels above), `runners/{capability,regression,smoke,traffic-monitor}.ts` (per-suite logic), `sampler.ts` (traffic-monitor chat sampling), `prechecks.ts`, `config.ts`, `evaluators/{faithfulness,relevance,response-quality,safety,citation-accuracy,tool-usage}.ts`
```

### Task C5: Verify and commit Phase C

- [ ] **Step 1: Re-read both files**

Open `docs/operations/DEPLOYMENT.md` lines 160-180 and `.claude/rules/operations.md` lines 1-30. Confirm:

- Evaluator count is 7 (DEPLOYMENT.md:169).
- Schema citation reads `:560-563` (DEPLOYMENT.md:170).
- Dashboard description names three suites (operations.md:11) and uses `/admin/evals`.
- File list includes orchestrator and runners (operations.md:13).

- [ ] **Step 2: Format check**

```bash
bun format:check docs/operations/DEPLOYMENT.md .claude/rules/operations.md
```

Run `bun format` on either if it fails.

- [ ] **Step 3: Confirm no lingering 5-evaluator references in operator docs**

```bash
grep -rn "5 LLM-judge\|five LLM-judge\|5 evaluators" docs/ .claude/rules/
```

Expected: no matches. If any appear in scope, fix them.

- [ ] **Step 4: Final cross-file deletion-marker grep across all five edited files**

```bash
grep -n "template-switcher\|widgets/\|layout/templates\|eval-preferences\|getEvalsDashboardWithLayout" \
  docs/architecture/OVERVIEW.md \
  docs/reference/FILE-INDEX.md \
  docs/reference/API.md \
  docs/operations/DEPLOYMENT.md \
  .claude/rules/operations.md
```

Expected: no matches. The earlier A8 grep covered only the two Phase A files; this one closes the loop across all five edits in this plan.

- [ ] **Step 5: Commit**

```bash
git add docs/operations/DEPLOYMENT.md .claude/rules/operations.md
git commit -m "$(cat <<'EOF'
docs(evals): correct evaluator count, schema citation, suite framing

DEPLOYMENT.md said 5 LLM-judge evaluators; the pipeline runs 7 (5
LLM-judge + prechecks + tool-usage). Schema citation 558-560 was off
by a few lines — the policy note lives at schema.ts:560-563.
operations.md singled out 'Traffic Monitor section' but the dashboard
treats capability, regression, and traffic-monitor symmetrically, and
its key-files list omitted the runners directory where the failure
labels are now emitted (runners/shared.ts:141,202).
EOF
)"
```

---

## Phase D — Visual showcase of the eval dashboard

The eval dashboard is the kind of feature where prose underplays the value. This phase ships a triplet of assets matching the existing README convention — `evals.mp4` (source recording), `evals.gif` (animated display), `evals-poster.png` (static frame) — and wires them into a new "Continuous evals" subsection in `README.md`.

**Workflow split:** the **user records the source `evals.mp4`** (the visual judgment + access to the dashboard sit with them); the **agent does conversion, integration, and verification** (mechanical work). This split mirrors the existing demo pipeline — every demo in `docs/assets/demos/` is a triplet (`<name>.mp4`, `<name>-poster.png`, `<name>.gif`) created from a single source `.mp4`.

**Existing fleet — match these specs exactly:**

| Demo       | `.gif` size | `.mp4` size | Native res | README width |
| ---------- | ----------- | ----------- | ---------- | ------------ |
| `canvas`   | 1.10 MB     | 325 KB      | 900×526    | 880          |
| `research` | 2.03 MB     | 427 KB      | 900×526    | 880          |
| `geo`      | 1.90 MB     | 281 KB      | 900×526    | 880          |

**Quality bar — non-negotiable:**

- **Native resolution: 900×526 pixels** (matches the fleet exactly — display `width="880"` in HTML is layout sizing, not the source res).
- **Filesize targets:** GIF ≤ 2.2 MB (matching the heaviest existing demo), MP4 ≤ 500 KB, poster PNG ≤ 350 KB.
- **Real data, threshold breach visible.** Dashboard must show populated capability, regression, and traffic-monitor suites with at least one threshold-breached run so `CompactAlert` is exercised.
- **No PII / no sampled chat content visible.** If your recording walks through Traffic Monitor, scrub or skip frames that surface real user prompts. Capability and regression suites are the safer focus.
- **Dark theme.** Match the existing demos.
- **Duration: 8–12 seconds, looping.**

### Task D1 — USER: Record the source `evals.mp4`

**Files:**

- Create: `docs/assets/demos/evals.mp4` (user-recorded)

> **This task is performed by the user, not the agent.** The user has direct access to the dashboard, owns the visual judgment, and can scrub PII. The agent's role is to prepare the dashboard and tell the user exactly what to record.

- [ ] **Step 1: Stage the dashboard with realistic data (agent prepares this)**

```bash
psql "$DATABASE_URL" -c "SELECT suite, COUNT(*) FROM eval_summaries GROUP BY suite;"
```

Expected: rows in all three suites. If empty:

```bash
cd services/evals
EVAL_RUN_MODE=capability bun run start   # then regression, then traffic-monitor
```

> **Use `bun run start`, not `bun run dev`.** `services/evals/package.json` defines `dev` as `bun run --watch src/index.ts` — the `--watch` flag hot-reloads on file changes and won't cleanly exit after one run. `start` is `bun run src/index.ts` — single-shot, exits when the run completes, which is what you want for staging.

- [ ] **Step 2: Stage a threshold breach**

The threshold is read from the `SCORE_THRESHOLD` env var (default `0.8`) at `services/evals/src/config.ts:153` — it is **per-run**, not per-suite, and lives in the env, not in source. To stage a breach without source edits, raise the threshold for one run:

```bash
cd services/evals
SCORE_THRESHOLD=0.99 EVAL_RUN_MODE=capability bun run start
```

Verify the breach landed:

```bash
psql "$DATABASE_URL" -c "SELECT suite, pass_rate, threshold_breached FROM eval_summaries WHERE threshold_breached = true ORDER BY created_at DESC LIMIT 3;"
```

- [ ] **Step 3: Sanity-check the dashboard renders**

```bash
bun dev
```

Open `http://localhost:43100/admin/evals`. Confirm:

- "Suites" view shows three suite cards with non-empty score rings.
- The threshold-breach alert (`CompactAlert`) is visible.
- Clicking a suite drills in via `?suite=…` and shows `EvaluatorBreakdown` + `CollapsibleComparison`.
- Switching to "Run history" via `?view=history` shows the recent-runs list.

**If any check fails, fix before handing off to the user — do not let them record a broken state.**

- [ ] **Step 4: USER records `docs/assets/demos/evals.mp4`**

User instructions to convey:

> Record an 8-12 second screen capture of `http://localhost:43100/admin/evals` walking this script:
>
> 1. Land on Suites view; let the threshold alert and three suite cards register (~1.5s).
> 2. Click into a suite (capability is good — no PII risk). Drilldown opens. (~2s)
> 3. Expand the collapsible comparison panel. (~1.5s)
> 4. Click back / "Suites" tab.
> 5. Click "Run history" tab; list renders. (~2s)
> 6. End on the Run history view.
>
> **Settings:**
>
> - Capture native resolution: **900×526 pixels** (or capture larger and downscale — final output is 900×526). On macOS, QuickTime's "New Screen Recording" with selection works; trim with QuickTime or `ffmpeg -ss/-to`.
> - Format: `.mp4` (H.264). Save to `docs/assets/demos/evals.mp4`.
> - Dark theme.
> - No real chat content visible — if Traffic Monitor frames surface, skip the section or pause on a non-PII frame.
>
> **Once `evals.mp4` exists in `docs/assets/demos/`, the agent will take over from D2.**

### Task D2 — AGENT: Generate `evals.gif` and `evals-poster.png` from the source mp4

**Files:**

- Read: `docs/assets/demos/evals.mp4` (user-supplied in D1)
- Create: `docs/assets/demos/evals.gif`
- Create: `docs/assets/demos/evals-poster.png`

- [ ] **Step 1: Verify tooling**

```bash
which ffmpeg pngquant
```

Expected: both present (already verified — `ffmpeg` 8.0.1 and `pngquant` 3.0.3 are at `/opt/homebrew/bin/`). `gifsicle` is **not** required — ffmpeg's two-pass palette-based GIF encoding produces better quality at the same filesize.

- [ ] **Step 2: Verify the source mp4 exists and is sane**

```bash
ls -lh docs/assets/demos/evals.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,r_frame_rate -of default=nw=1 docs/assets/demos/evals.mp4
```

Expected: file ≤ ~500 KB, dimensions reasonable (will normalize to 900×526), duration 8–12s. If duration is way off, ask the user to re-record.

- [ ] **Step 3: Generate the GIF (two-pass palette encoding)**

```bash
cd docs/assets/demos
ffmpeg -y -i evals.mp4 \
  -vf "fps=15,scale=900:-1:flags=lanczos,palettegen=stats_mode=full" \
  evals-palette.png

ffmpeg -y -i evals.mp4 -i evals-palette.png \
  -lavfi "fps=15,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" \
  evals.gif

rm evals-palette.png
ls -lh evals.gif
cd -
```

Target: ≤ 2.2 MB. If too large:

- Drop fps from 15 → 12: change `fps=15` to `fps=12` in both passes.
- Reduce dither: `bayer_scale=5` → `bayer_scale=4` (fuzzier, smaller).
- Trim duration: re-encode source first with `ffmpeg -ss 0 -to 10 -i evals.mp4 evals-trimmed.mp4` and use that as input.

- [ ] **Step 4: Generate the poster (one representative frame)**

Pick a frame that shows the Suites view with the threshold alert visible — the same frame an above-the-fold static could use. Frame at ~1.0 second usually lands on the post-load steady state:

```bash
cd docs/assets/demos
ffmpeg -y -ss 1.0 -i evals.mp4 -frames:v 1 -vf "scale=900:-1:flags=lanczos" evals-poster.png

# Compress with pngquant
pngquant --quality=70-85 --skip-if-larger --force --output evals-poster.png evals-poster.png
ls -lh evals-poster.png
cd -
```

Target: ≤ 350 KB. If the chosen frame doesn't show the alert clearly, vary `-ss 1.0` (try 0.5, 1.5, 2.0) until a representative frame is captured.

- [ ] **Step 5: Side-by-side compare against existing demos**

```bash
ls -lh docs/assets/demos/evals.{mp4,gif} docs/assets/demos/evals-poster.png
ls -lh docs/assets/demos/{canvas,research,geo}.{mp4,gif} docs/assets/demos/{canvas,research,geo}-poster.png
file docs/assets/demos/evals.{mp4,gif} docs/assets/demos/evals-poster.png
```

Confirm:

- `evals.gif` is GIF89a, ~900×526 (per `file`), ≤ 2.2 MB.
- `evals.mp4` reasonable size.
- `evals-poster.png` ≤ 350 KB.
- Dimensions and filesizes sit in the same range as the existing fleet.

Open `evals.gif` next to `canvas.gif`, `research.gif`, `geo.gif` in a viewer (Quick Look on macOS). Pacing and visual density should feel like a sibling, not an outlier.

### Task D3 — AGENT: Wire the showcase into `README.md`

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Insert the new showcase subsection**

Match the existing demo pattern exactly — plain `<img>` tag, `width="880"`, descriptive alt text. The existing demos do not use `<picture>` for reduced-motion fallback even though posters exist; **match the existing pattern, do not improve it in this commit** (a separate a11y plan can later wire posters into `<picture>` for all four demos at once).

Edit `README.md`. Find:

```
<img src="docs/assets/demos/geo.gif" alt="Polymorph geo intelligence: interactive maps and data tables inline" width="880">
```

After the closing `>` of that tag and the trailing blank line, insert:

```markdown
### Continuous evals

A live-data admin dashboard surfaces the evaluator pipeline that scores every change: capability, regression, and traffic-monitor suites with per-suite drilldown, threshold alerts, and a run-history timeline. Backed by a Railway cron that scores sampled production traffic against an LLM judge and writes summaries to Postgres.

<img src="docs/assets/demos/evals.gif" alt="Polymorph continuous evals: three suites with per-suite drilldown, threshold alert, and run-history timeline" width="880">
```

- [ ] **Step 2: Add the Features bullet**

Edit `README.md`. Find the bullet list under `## Features`. The bullet "**Multi-provider AI**" exists at line 44. Append a new bullet **immediately after** it so the new bullet sits between "Multi-provider AI" and "Voice mode":

```
- **Continuous evals** — LLM-judge scoring of capability, regression, and sampled production traffic, with a live admin dashboard, threshold alerts, and a Phoenix experiment per run
```

- [ ] **Step 3: Verify the README still renders cleanly**

```bash
grep -n "evals" README.md
bun format:check README.md
```

If `format:check` fails, run `bun format README.md`. Then visually confirm both insertions:

```bash
gh repo view --web   # or open the local README in a Markdown previewer
```

Confirm on github.com (preferred — it renders differently from local previews):

- "Continuous evals" subsection sits between Geo and `## Features`.
- GIF auto-plays.
- Features bullet appears once, between Multi-provider AI and Voice mode.
- No broken image links.

### Task D4 — AGENT: Verify and commit Phase D

- [ ] **Step 1: Asset hygiene**

```bash
ls -lh docs/assets/demos/evals*
file docs/assets/demos/evals*
```

Confirm:

- `evals.mp4` valid MP4, ≤ ~500 KB.
- `evals.gif` valid GIF89a, ≤ 2.2 MB.
- `evals-poster.png` valid PNG, ≤ 350 KB.
- No stray intermediate files (e.g. leftover `evals-palette.png`, `evals-trimmed.mp4`).

- [ ] **Step 2: Confirm asset paths resolve from README**

```bash
for path in $(grep -oE 'docs/assets/demos/evals[^"]*' README.md | sort -u); do
  test -f "$path" && echo "OK $path" || echo "MISSING $path"
done
```

Expected: all `OK`.

- [ ] **Step 3: Confirm filesize sanity vs. fleet**

```bash
ls -lh docs/assets/demos/{canvas,research,geo,evals}.gif
```

The new `evals.gif` should be in the same order of magnitude as the existing three (1.1–2.2 MB). If it's noticeably larger, return to D2 Step 3 and reduce.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/assets/demos/evals.mp4 docs/assets/demos/evals.gif docs/assets/demos/evals-poster.png
git commit -m "$(cat <<'EOF'
docs: showcase the continuous evals dashboard in README

Add evals.{mp4,gif} and evals-poster.png to docs/assets/demos/ matching
the existing canvas/research/geo triplet pattern (900x526 native, ~2 MB
GIF, dark theme, threshold-breach state visible). New "Continuous evals"
subsection under "See it in action" and matching bullet under Features.
The GIF walks Suites view → drilldown → Run history.
EOF
)"
```

---

## Self-Review Checklist (run after writing all tasks)

- [ ] **Spec coverage:** Every audit finding labeled "Critical drift" (#1-#8) maps to a task: A1 (#1), A2 (#2), A3 (#3), A4 (#4), A6 (#5), A5 (#6), C1 (#7), B2 (#8). The "Significant gaps" #10, #11, #13 map to C3, C4, C2. Gap #12 (six undocumented features) is explicitly out of scope and called out for follow-up. Audit-discovered gaps covered by: A1b (adjacent OVERVIEW.md:51 drift), A4 Step 5 (missing `lib/evals/glossary.ts` row), A6 Step 3b (`FILE-INDEX.md:799` "+ layout models" framing), A6 Step 7 (orphan helpers in `lib/evals/helpers/`), A7 (orphan `user_eval_preferences`).
- [ ] **Prose accuracy (Phase A):** Every `dashboard-v2/` Purpose cell traces to actual code, not naming-based guesswork. Critical: `auto-badge.tsx` marks deterministic evaluators (per `evaluator-breakdown.tsx:14,29-30`), NOT cron-sourced runs. `suite-selector.tsx` renames suites for display (Benchmarks/Live traffic/Pinned checks). `compact-alert.tsx` only handles threshold breaches. `local-labels.ts` exists for the 2-column-row line-length workaround.
- [ ] **Placeholder scan:** No "TBD," no "implement appropriate handling," no "similar to Task N." Each Edit step has both `old_string` and `new_string` complete.
- [ ] **Type / signature consistency:** All references to `getEvalsDashboard` (no `WithLayout`), `dashboard-v2/`, `glossary/`, `runners/shared.ts:141,202`, `lib/db/schema.ts:560-563`, `sampler.ts:551` for `intent` derivation. No leftover references to `LayoutRenderer`, `template-switcher`, `widgets/registry`, `combined-trend`, or `gifsicle`.
- [ ] **Phase D quality bar:** Source `.mp4` exists at `docs/assets/demos/evals.mp4`. GIF is 900×526 native and ≤ 2.2 MB (matches heaviest existing demo). Poster PNG ≤ 350 KB. README markup uses `width="880"` and matches the existing `<img>` pattern (no `<picture>` for this commit). Threshold-breach alert visible in poster frame. No PII visible in any frame.
- [ ] **Tooling sanity:** `which ffmpeg pngquant` both resolve. The plan does NOT depend on `gifsicle` (not installed) or `mcp__claude-in-chrome__gif_creator` (deferred MCP tool, schema unverified).

## Follow-up plan (out of scope here)

A separate plan should cover the six audit findings in "Significant gaps" item #12 — features that landed without operator coverage:

1. Threshold breach soft-fail behavior and `EVAL_EXIT_ON_THRESHOLD_BREACH` semantics (PR #167).
2. Opt-in judge wire-level param logging (`f8ada4e`).
3. Phoenix feedback / trace correlation (`99a90ca`).
4. Traffic Monitor replay deep-dive (`f48a329`) — the mechanism, not just the API surface.
5. Golden validation hardening (`d727a5a`).
6. Eval glossary UI behavior (the `components/evals/glossary/` subsystem; this plan adds it to the file index but doesn't explain its UX role).

Each requires reading the feature code first to write accurate prose. Open as a follow-up after this plan merges.

**Additional follow-ups from this plan's audit:**

7. **Drop the orphan `user_eval_preferences` table.** Task A7 only updates the FILE-INDEX schema row; the table itself, the `UserEvalPreference` type, and any Drizzle migration history remain in `lib/db/schema.ts:625-648`. A separate migration-bearing plan should remove the table once we're confident no out-of-tree consumer (e.g. an old branch) still queries it.
8. **Document undocumented `services/evals/src/` files.** `error.ts` (defines `EvalSummaryPersistError`) and `eval-summary.ts` are absent from `FILE-INDEX.md` lines 979-1003. Low-stakes additions but worth a sweep.
