# Plan 4 - Eval Traffic Monitor: True Replay

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Change the `traffic-monitor` suite from historical re-grading to true replay:

- Sample a coherent historical target turn from production chat data.
- Reconstruct enough conversation context to ask the current production path the same user question.
- Judge the fresh answer returned by `/api/evals/run`.
- Persist the same `eval_summaries` shape the admin dashboard already consumes.

This makes Traffic Monitor a regression signal for the current system instead of a score refresh for stored answers.

## Audit Corrections

The first draft was directionally right on replay semantics but missed several required gates:

- `/api/evals/run` rejected `suite: 'traffic-monitor'`; the app-side schema and local `EvalSuite` type must accept it before replay can work.
- `services/evals` did not require `EVAL_RUNNER_URL` / `EVAL_RUNNER_SECRET` for `traffic-monitor`, even though replay posts to the app runner.
- The sampler could not stay out of scope. Pairing the first user question with the last assistant answer can create incoherent examples; the suite must sample a single target assistant turn with its preceding user turn and canonical UI-message context.
- Partial replay failure needs explicit behavior: persist successful replays, warn on partial failure, abort only when every replay fails.
- Dashboard/docs still described daily Traffic Monitor behavior and two-suite comparison assumptions, while the intended baseline is a Railway-managed 48-hour cron plus manual triggers.
- Verification must include both root tests/typecheck and `services/evals` package-local tests/typecheck; root commands do not cover the eval service package.

## Scope

**Modified code and tests**

- `app/api/evals/run/route.ts`
- `app/api/evals/run/route.test.ts`
- `lib/streaming/eval-chat-runner.ts`
- `lib/streaming/__tests__/eval-chat-runner.test.ts`
- `services/evals/src/config.ts`
- `services/evals/src/config.test.ts`
- `services/evals/src/sampler.ts`
- `services/evals/src/sampler.test.ts`
- `services/evals/src/runners/traffic-monitor.ts`
- `services/evals/src/runners/traffic-monitor.test.ts`
- `services/evals/src/index.test.ts`
- `components/evals/dashboard-v2/dashboard.test.tsx`
- `components/evals/widgets/layout-renderer.tsx`
- `components/evals/widgets/layout-renderer.test.tsx`
- `components/evals/widgets/page-header.tsx`
- `components/evals/widgets/kpi-tile.tsx`
- `components/evals/widgets/suite-header-card.tsx`
- `components/evals/widgets/score-ring-widget.tsx`
- `components/evals/widgets/activity-feed.tsx`
- `components/evals/widgets/empty-state.tsx`
- `lib/evals/layout/templates.ts`

**Modified docs**

- `docs/operations/DEPLOYMENT.md`
- `docs/reference/API.md`
- `docs/reference/FILE-INDEX.md`
- `docs/superpowers/plans/2026-04-22-plan-4-eval-traffic-monitor-true-replay.md`

**Out of scope**

- No `eval_summaries` schema change.
- No new rate limiter or cost cap beyond the existing `SAMPLE_SIZE`, `LOOKBACK_HOURS`, and `EVAL_CASE_CONCURRENCY` controls.
- No first-class comparison between historical answer and fresh answer. This can be a later evaluator or dashboard diff, but it is not required for true replay.
- No production dry run unless valid runner, Supabase, Phoenix, and judge credentials are available in the active shell.

## Task 1: Open the app runner gate

**Why:** Traffic Monitor replay posts cases to `/api/evals/run`. If the app schema rejects `traffic-monitor`, every sampled case fails before it reaches the researcher pipeline.

- [ ] Widen `app/api/evals/run/route.ts` request validation to accept `suite: 'traffic-monitor'`.
- [ ] Widen the local `EvalSuite` union in `lib/streaming/eval-chat-runner.ts` to include `traffic-monitor`.
- [ ] Add route coverage proving a traffic-monitor request is accepted and forwarded to `runEvalChat`.
- [ ] Add runner coverage proving eval context carries `caseId`, `suite`, and `executionMode: 'eval'` for traffic-monitor.

**Exit gate**

```bash
bun run test -- app/api/evals/run/route.test.ts lib/streaming/__tests__/eval-chat-runner.test.ts
```

## Task 2: Require runner credentials for traffic-monitor

**Why:** True replay needs the app runner URL and shared secret. Missing env vars should fail at config creation, not halfway through a cron run.

- [ ] Update `requiredEvalRunnerSettings()` in `services/evals/src/config.ts` so `traffic-monitor` requires `EVAL_RUNNER_URL` and `EVAL_RUNNER_SECRET`.
- [ ] Add config tests for missing URL and missing secret in `EVAL_RUN_MODE=traffic-monitor`.
- [ ] Keep low-volume defaults aligned with production Traffic Monitor defaults: `SAMPLE_SIZE=10`, `LOOKBACK_HOURS=48`, `EVAL_CASE_CONCURRENCY=1`.

**Exit gate**

```bash
cd services/evals && bun run test -- src/config.test.ts
```

## Task 3: Sample coherent target turns

**Why:** The replay case must correspond to one real user/assistant target turn. The old first-user/last-assistant shape can mix unrelated turns from a long chat and produce misleading judge input.

- [ ] Query eligible assistant target turns with their preceding user turn and same-chat context.
- [ ] Prefer canonical `messages.ui_message` content and metadata.
- [ ] Fall back to legacy `parts` rows when canonical UI-message data is missing.
- [ ] Preserve per-turn search results, citations, and tool names from target assistant metadata.
- [ ] Preserve sampled `searchMode`, `modelType`, and original model metadata when present; label missing mode metadata instead of guessing silently.
- [ ] Emit `ChatSample.conversation` so the replay runner can send real context to `/api/evals/run`.

**Exit gate**

```bash
cd services/evals && bun run test -- src/sampler.test.ts src/index.test.ts
```

## Task 4: Replay through the shared runner

**Why:** Traffic Monitor should use the same case execution path as capability and regression. Fresh `answerText`, `modelId`, `durationMs`, citations, tools, and search results should come from the app runner response.

- [ ] Build `EvalCase[]` from `ChatSample.conversation`, `searchMode`, `modelType`, target turn IDs, and metadata tags.
- [ ] Call `runCasesConcurrently(cases)`.
- [ ] Build Phoenix dataset examples from `succeeded.map(s => s.caseSpec)` and `succeeded.map(s => s.result)`.
- [ ] Warn when some replay cases fail.
- [ ] Throw before Phoenix dataset creation when all replay cases fail.
- [ ] Preserve existing Phoenix experiment, threshold, and `eval_summaries` persistence behavior after replay succeeds.

**Exit gate**

```bash
cd services/evals && bun run test -- src/runners/traffic-monitor.test.ts
```

## Task 5: Align dashboard and docs

**Why:** The UI and docs should describe the actual three-suite dashboard and Railway-managed Traffic Monitor cadence.

- [ ] Update dashboard copy from daily sampling to cron/manual trigger language.
- [ ] Change Template B copy from two-suite to three-suite comparison and include regression in the header subtitle.
- [ ] Treat regression-only data as enough to render the dashboard instead of showing the global empty state.
- [ ] Adjust Traffic Monitor sample-count thresholds for a 10-sample baseline.
- [ ] Adjust freshness thresholds for a 48-hour cron baseline.
- [ ] Update `DEPLOYMENT.md` with `traffic-monitor` runner env requirements, `EVAL_RUN_MODE`, `PHOENIX_PUBLIC_URL`, and warning-only threshold semantics.
- [ ] Update `API.md` so `/api/evals/run` documents `traffic-monitor`, no chat persistence, and the response shape.
- [ ] Move `app/api/evals/run/route.ts` out of the Canvas API section in `FILE-INDEX.md`.

**Exit gate**

```bash
bun run test -- components/evals/dashboard-v2/dashboard.test.tsx components/evals/widgets/layout-renderer.test.tsx lib/evals/layout/__tests__/templates.test.ts
```

## Verification Checklist

Run these before claiming the branch is ready:

```bash
bunx prettier --write app/api/evals/run/route.ts app/api/evals/run/route.test.ts lib/streaming/eval-chat-runner.ts lib/streaming/__tests__/eval-chat-runner.test.ts components/evals/dashboard-v2/dashboard.test.tsx components/evals/widgets/layout-renderer.tsx components/evals/widgets/layout-renderer.test.tsx components/evals/widgets/page-header.tsx components/evals/widgets/kpi-tile.tsx components/evals/widgets/suite-header-card.tsx components/evals/widgets/score-ring-widget.tsx components/evals/widgets/activity-feed.tsx components/evals/widgets/empty-state.tsx lib/evals/layout/templates.ts docs/operations/DEPLOYMENT.md docs/reference/API.md docs/reference/FILE-INDEX.md docs/superpowers/plans/2026-04-22-plan-4-eval-traffic-monitor-true-replay.md
```

```bash
cd services/evals && bunx prettier --write src/config.ts src/config.test.ts src/sampler.ts src/sampler.test.ts src/runners/traffic-monitor.ts src/runners/traffic-monitor.test.ts src/index.test.ts
```

```bash
bun run test -- app/api/evals/run/route.test.ts lib/streaming/__tests__/eval-chat-runner.test.ts components/evals/dashboard-v2/dashboard.test.tsx components/evals/widgets/layout-renderer.test.tsx lib/evals/layout/__tests__/templates.test.ts
```

```bash
cd services/evals && bun run test -- src/config.test.ts src/sampler.test.ts src/runners/traffic-monitor.test.ts src/index.test.ts
```

```bash
bun run typecheck
```

```bash
cd services/evals && bunx tsc --noEmit -p tsconfig.json
```

Optional live sanity run, only when credentials and a dev server are available:

```bash
bun dev
```

```bash
EVAL_RUN_MODE=traffic-monitor bun run --cwd services/evals start
```

Expected live-run evidence:

- Logs show sampling before replay and replay before Phoenix dataset creation.
- The Phoenix dataset output contains non-empty `modelId`.
- `durationMs` is positive.
- `answerText` is the fresh runner response, not the historical stored answer.
