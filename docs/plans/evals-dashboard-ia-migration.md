# Evals Dashboard IA Migration

**Status:** Completed historical plan. The canonical `/admin/evals` route now renders the dashboard-v2 IA; the demo route is no longer the promotion target.
**Former demo URL:** `/admin/evals/demo-redesign`
**Canonical route:** `/admin/evals` (rendered by `EvalsDashboardV2`)
**Estimated effort to migrate:** ~3-4 focused hours.

## Why this exists

The current `/admin/evals` dashboard rendered three sections at once with no functional navigation: an `OverviewView`/`SuitesView`/`HistoryView` switcher whose tabs only updated state but never changed what was on screen, an always-on `KpiStrip` whose four tiles duplicated information already shown in the per-suite cards, an always-on `ComparisonTable` that screamed for attention even when nothing diverged, and a 14-day trend chart whose data sat in a 75-95% band that no human can read for trend-detection. The page asked the viewer to do too much triage at the top and left no room for drill-down.

The redesign at `/admin/evals/demo-redesign` cuts those overlaps. Each surviving element answers a question that no other element answers, and nothing renders unless it's currently doing work for the user.

## What the demo does

| Element                                         | What it shows                                                                            | What it replaces                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Functional 2-tab `ViewSwitcher`                 | URL-driven `?view=suites` / `?view=history`, refresh-safe via `history.replaceState`     | The visual-only `ViewSwitcher` in `components/evals/dashboard/header.tsx` |
| `CompactAlert`                                  | Single-row banner with suite + failing judges + metric + Phoenix link                    | The full-width `AlertBanner` Card                                         |
| `SuiteSelector`                                 | 3 clickable cards (Benchmarks / Live traffic / Pinned checks) showing each suite's score | The single-suite `ScoreFeature` lock-in to Capability                     |
| Per-suite `ScoreFeature` + `EvaluatorBreakdown` | Active suite's ring + per-judge bars with `AUTO` badges on deterministic rows            | Full evaluator detail was previously buried in the comparison table       |
| `CompareToggle` → `ComparisonTable`             | On-demand comparison of curated vs live divergence                                       | Always-on `ComparisonTable`                                               |
| `Run history` tab                               | Existing `ActivityList` as its own surface                                               | Always-rendered `ActivityList` at the bottom                              |

What got cut entirely: `KpiStrip` (duplicated suite info), `CombinedTrend` chart (no decisions traced to it), the `Overview` tab (was already redundant once the suite cards landed).

## Migration phases

### Phase 1 — promote layout to canonical

Move the demo structure into the live render path. The mock data wiring is the only thing that needs swapping; every visual primitive is already shared with the live dashboard.

**Touch:**

- `components/evals/dashboard-v2/dashboard.tsx` — replace its body with the structure from `components/evals/demo/redesign-dashboard.tsx`. Swap `MOCK` for the `data` prop.
- New file: `components/evals/dashboard-v2/header.tsx` containing `Header` + `ViewSwitcher` from the demo, OR retire `components/evals/dashboard/header.tsx` and replace it with the demo's version.
- New files: `components/evals/dashboard-v2/{suite-selector,evaluator-breakdown,compact-alert,compare-toggle,auto-badge}.tsx` extracted from the demo.
- `components/evals/dashboard-v2/local-labels.ts` — small `LOCAL_LABEL_OVERRIDES` map (`deterministic_prechecks` → `Prechecks`).

**Don't touch:**

- `components/evals/dashboard/score-feature.tsx`, `score-bar.tsx`, `comparison-table.tsx`, `activity-list.tsx`, `widgets/alert-banner.tsx`, `glossary/*` — all still composed as-is.

**Why this shape:** keeping the new pieces under `dashboard-v2/` (rather than starting `dashboard-v3/`) signals "this is the canonical evals dashboard." The directory name has earned its right to host the latest structure, and a v3 directory would imply a parallel implementation.

### Phase 2 — decide on the shared `AlertBanner`

The demo's `CompactAlert` is a local copy. The same pattern would benefit the live `AlertBanner` (it's also too tall on every other surface that consumes it).

Two options:

- **(A)** Replace `components/evals/widgets/alert-banner.tsx` body with the compact pattern. Preserves the data-testid `eval-alert-banner` so existing tests still target the same element.
- **(B)** Leave `AlertBanner` as the long-form variant for one-off use; promote `CompactAlert` to a sibling component for dashboards.

**Recommendation:** (A). The long-form variant isn't actually used anywhere else in the codebase (`grep "AlertBanner" components/`). If the long form ever comes back as a need, branch then. Don't keep two banner shapes for hypothetical use.

**Test impact:** Any test that asserts on the alert's body copy will need updating. Run `bun run test -- alert-banner` to surface them.

### Phase 3 — cut the demo surface

After phase 1 lands and the canonical route shows the new structure, delete the now-stale demo:

- `app/(admin)/admin/evals/demo-redesign/page.tsx`
- `app/(admin)/admin/evals/demo/page.tsx`
- `app/(admin)/admin/evals/demo-mixed/page.tsx`
- `components/evals/demo/redesign-dashboard.tsx`
- `components/evals/demo/polished-dashboard.tsx`
- `components/evals/demo/mixed-dashboard.tsx`
- `components/evals/demo/` directory itself once empty

Components no longer consumed anywhere after the demo deletes:

- `components/evals/dashboard/kpi-strip.tsx` — only the canonical and the demos use this; canonical drops it in phase 1
- `components/evals/dashboard/combined-trend.tsx` — same story

`grep` for both names before deleting to confirm no stragglers.

### Phase 4 — verification before merge

| Check                       | How                                             | Pass criteria                                                    |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Lint                        | `bun lint`                                      | 0 errors in changed files                                        |
| Typecheck                   | `bun typecheck`                                 | 0 errors in changed files                                        |
| Tests                       | `bun run test`                                  | All eval-related tests green                                     |
| Route loads                 | Browser: `/admin/evals`                         | No console errors, no missing components                         |
| Deep link `?view=suites`    | Browser: paste URL fresh                        | Lands on Suites tab                                              |
| Deep link `?view=history`   | Browser: paste URL fresh                        | Lands on Run history tab                                         |
| Tab switch updates URL      | Browser: click tabs                             | URL updates without page reload                                  |
| Suite cards swap drill-down | Browser: click each card                        | `ScoreFeature` ring + `EvaluatorBreakdown` update to that suite  |
| Judge tooltip               | Browser: hover any evaluator row                | Rich tooltip with definition + threshold + failure modes         |
| `ScoreFeature` ring tooltip | Browser: hover the ring                         | Per-judge breakdown popover                                      |
| Compare toggle              | Browser: click "Show comparison"                | `ComparisonTable` reveals; click again hides                     |
| Alert link                  | Browser: click "Open Phoenix →" in CompactAlert | New tab opens to alert's `phoenixUrl`                            |
| Activity list expand        | Browser: click any row in Run history           | Per-judge breakdown expands; Phoenix link works                  |
| Mobile width                | Browser: resize to ~400px                       | Suite cards stack vertically; evaluator breakdown stays readable |
| Keyboard navigation         | Tab through dashboard                           | Cards, rows, toggle all reachable; focus rings visible           |
| Screen reader               | VoiceOver: read aloud                           | View tabs announce as radio group; cards announce as buttons     |

### Phase 5 — deploy

This is a cosmetic IA change, not a data or schema change. Standard Vercel deploy applies. No migration, no flag, no rollout strategy needed beyond:

- Merge to `main`
- Vercel auto-deploys
- Smoke test the production `/admin/evals` route
- If broken: revert the merge commit; the previous `EvalsDashboardV2` returns

## Resolved decisions (locked in before phase 1)

All five questions have been answered by the product owner. The demo now reflects the resolved state — phase 1's job is to lift the demo into the canonical render path with no further design choices to make.

1. **"Prechecks" label — local override.** `LOCAL_LABEL_OVERRIDES` lives in `dashboard-v2/local-labels.ts` only. `lib/evals/evaluator-labels.ts` keeps "Deterministic Prechecks" as the canonical name; ActivityList, ComparisonTable, ScoreFeature tooltip, and Phoenix data all continue to use the longer form. Trade-off accepted: two names for the same thing across surfaces, in exchange for zero blast radius.
2. **Compare section — default expanded with chevron collapse.** Replaces the verbose "Show comparison side-by-side" pill button with a standard collapsible section. Defaults to open; chevron-up button in top-right collapses to a single-row header showing "Where curated and live diverge ▾". Pattern: `lucide-react` `ChevronUp`/`ChevronDown` icons.
3. **CombinedTrend chart — deleted entirely.** No sparkline, no collapsible. Phoenix is the canonical place for time-series investigation via "Inspect in Phoenix →". `components/evals/dashboard/combined-trend.tsx` gets deleted in phase 3. **Action item before merge:** post a Slack heads-up so anyone with chart muscle memory isn't surprised.
4. **`SuiteSelector` clicks — `?suite=` lands in phase 1.** Both URL params (`?view=` and `?suite=`) ship together so there's no legacy bookmark migration later. Implementation: same `replaceState` pattern as `?view=`. Refresh-safe; deep-linkable.
5. **Active-suite tagline — cut, keep suite name + "on demand" badge.** Tagline previously rendered above the score ring is removed. The SuiteSelector card above already shows the tagline, so the ring header was duplicating. The "on demand" / cron cadence badge stays — it's the one piece of unique info above the ring. Implementation: `ScoreFeature` gains a `hideTagline?: boolean` prop (defaults to `false` — backward-compatible). The new dashboard passes `hideTagline`; the existing live dashboard is unaffected until phase 1.

## Rollback

The changes are scoped to `components/evals/` and `app/(admin)/admin/evals/`. Reverting the merge commit restores the previous `EvalsDashboardV2`. No data or schema implications.

## File-by-file diff summary (anticipated)

```
M   components/evals/dashboard-v2/dashboard.tsx          (rewrite body)
A   components/evals/dashboard-v2/header.tsx             (or replace dashboard/header.tsx)
A   components/evals/dashboard-v2/suite-selector.tsx
A   components/evals/dashboard-v2/evaluator-breakdown.tsx
A   components/evals/dashboard-v2/compact-alert.tsx
A   components/evals/dashboard-v2/compare-toggle.tsx
A   components/evals/dashboard-v2/auto-badge.tsx
A   components/evals/dashboard-v2/local-labels.ts
M   components/evals/widgets/alert-banner.tsx            (phase 2 only)
D   components/evals/demo/                               (entire directory)
D   app/(admin)/admin/evals/demo-redesign/
D   app/(admin)/admin/evals/demo/
D   app/(admin)/admin/evals/demo-mixed/
D   components/evals/dashboard/kpi-strip.tsx             (no remaining consumers)
D   components/evals/dashboard/combined-trend.tsx        (no remaining consumers)
```

After migration completes and the demo is deleted, this plan file should also be removed (or moved to `docs/architecture/decisions/` if you want a record).
