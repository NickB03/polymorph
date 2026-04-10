# Phoenix US Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the Phoenix eval configuration on a clean US-hosted Phoenix instance by deploying the correct evals code revision and rerunning evals, without restoring historical traces, spans, or experiment results.

**Architecture:** The eval corpus, dataset naming, evaluator bundle, and score thresholds are defined in repo code, not only in Phoenix storage. Rebuild works by choosing the target corpus version from git history, validating that checkout locally, pointing `polymorph-evals` at the clean US Phoenix, and rerunning capability/regression evals so Phoenix recreates datasets and experiments from code.

**Tech Stack:** Railway, Phoenix, Bun, Vitest, git, `services/evals` runner code, Vercel env vars for ingestion clients.

---

## File Map

**Primary files and surfaces**

- Inspect: `services/evals/src/corpus/index.ts`
- Inspect: `services/evals/src/runners/shared.ts`
- Inspect: `services/evals/src/config.ts`
- Inspect: `services/evals/package.json`
- Inspect: `docs/operations/phoenix-recovery-notes-2026-04-10.md`
- Create: `docs/operations/phoenix-us-rebuild-cutover.md`

**Why these files matter**

- `services/evals/src/corpus/index.ts` defines `CORPUS_VERSION` and the actual eval cases.
- `services/evals/src/runners/shared.ts` builds dataset names, experiment names, and the evaluator bundle.
- `services/evals/src/config.ts` defines the runtime knobs and the required Phoenix env vars.
- `services/evals/package.json` defines the local validation commands.
- `docs/operations/phoenix-recovery-notes-2026-04-10.md` contains the recovery evidence showing the old EU volume is no longer required for this path.
- `docs/operations/phoenix-us-rebuild-cutover.md` will record the exact commit and cutover details once the rebuild is complete.

## Version Selection

Use the code revision that matches the configuration you want to recreate:

- `aa44e61` recreates corpus `v6`
- `3700408` recreates corpus `v5`
- `12d9e85` recreates corpus `v4`
- `8c6b626` is the latest commit still containing corpus `v2`

If the goal is "get me back to the latest known setup," use `aa44e61` or `main` if `main` still contains `CORPUS_VERSION = 'v6'`.

### Task 1: Choose the target corpus revision

**Files:**

- Inspect: `services/evals/src/corpus/index.ts`
- Inspect: `services/evals/src/runners/shared.ts`
- Inspect: `docs/operations/phoenix-recovery-notes-2026-04-10.md`

- [ ] **Step 1: Confirm the corpus version in the desired commit**

Run:

```bash
git show aa44e61:services/evals/src/corpus/index.ts | sed -n '1,20p'
git show 3700408:services/evals/src/corpus/index.ts | sed -n '1,20p'
git show 12d9e85:services/evals/src/corpus/index.ts | sed -n '1,20p'
git show 8c6b626:services/evals/src/corpus/index.ts | sed -n '1,20p'
```

Expected:

- One line near the top reads `const CORPUS_VERSION = 'v6'`, `v5`, `v4`, or `v2` respectively.

- [ ] **Step 2: Confirm the dataset naming logic did not move**

Run:

```bash
git show HEAD:services/evals/src/runners/shared.ts | sed -n '180,205p'
```

Expected:

- Output includes `buildStableDatasetName(suite)` returning `polymorph-${suite}-${getCorpusVersion()}`.

- [ ] **Step 3: Record the selected rebuild target**

Create `docs/operations/phoenix-us-rebuild-cutover.md` with this initial content:

```md
# Phoenix US Rebuild Cutover

- Target commit: <sha>
- Target corpus version: <v2|v4|v5|v6>
- Reason: recreate eval configuration only; historical run data intentionally discarded
- Target Phoenix region: us-east4
```

- [ ] **Step 4: Commit the cutover note**

Run:

```bash
git add docs/operations/phoenix-us-rebuild-cutover.md
git commit -m "docs: add Phoenix US rebuild cutover note"
```

Expected:

- A docs-only commit is created on the current branch.

### Task 2: Validate the selected checkout locally before touching Railway

**Files:**

- Inspect: `services/evals/src/corpus/index.ts`
- Inspect: `services/evals/src/runners/shared.ts`
- Inspect: `services/evals/src/config.ts`
- Test: `services/evals/src/runners/shared.test.ts`
- Test: `services/evals/src/runner.test.ts`

- [ ] **Step 1: Create a rebuild branch at the chosen revision**

Run:

```bash
git switch -c codex/phoenix-us-rebuild <selected-sha>
```

Expected:

- Git reports a new branch created from the target commit.

- [ ] **Step 2: Install dependencies if needed**

Run:

```bash
bun install
```

Expected:

- Bun completes without lockfile or dependency errors.

- [ ] **Step 3: Run the focused eval test suite**

Run:

```bash
bun test services/evals/src/runners/shared.test.ts services/evals/src/runner.test.ts
```

Expected:

- PASS for the targeted eval runner tests.

- [ ] **Step 4: Verify the runner command exists in the selected checkout**

Run:

```bash
cat services/evals/package.json
```

Expected:

- Output includes `"start": "bun run src/index.ts"` and `"test": "vitest run"`.

- [ ] **Step 5: Commit any rebuild-only docs updates**

Run:

```bash
git status --short
git add docs/operations/phoenix-us-rebuild-cutover.md
git commit -m "docs: finalize Phoenix rebuild target"
```

Expected:

- Either nothing to commit or a small docs-only commit.

### Task 3: Rebuild the clean US Phoenix service state

**Files:**

- Inspect: `services/evals/src/config.ts`
- Inspect: `docs/operations/phoenix-us-rebuild-cutover.md`

- [ ] **Step 1: Verify the target Railway service is the US-hosted `phoenix`**

Run:

```bash
railway status
railway service phoenix
railway deployment list --service phoenix --json | jq '.[0] | {id, status, createdAt, region, volumeMounts}'
```

Expected:

- The latest deployment is for `phoenix` and the region is `us-east4-*`.

- [ ] **Step 2: Confirm the clean Phoenix auth/env surface**

Run:

```bash
railway variable list -s phoenix
```

Expected:

- Output includes `PHOENIX_ENABLE_AUTH`, `PHOENIX_ADMIN_SECRET`, `PHOENIX_SECRET`, `PHOENIX_ADMINS`, `PORT`, and `PHOENIX_WORKING_DIR`.

- [ ] **Step 3: If the current service is polluted by failed experiments, reset only by using the clean US database path**

Run:

```bash
curl -sS https://phoenix-production-c6b5.up.railway.app/v1/projects
```

Expected:

- For a clean rebuild path, output should be empty or contain only the default project. If not, stop and explicitly decide whether to preserve or discard current US state.

- [ ] **Step 4: Capture the current US Phoenix baseline**

Append this to `docs/operations/phoenix-us-rebuild-cutover.md`:

```md
## Baseline before rebuild

- Phoenix project count: <count>
- Phoenix dataset count: <count>
- Phoenix evaluator count: <count>
- Phoenix deployment id: <deployment-id>
```

- [ ] **Step 5: Commit the baseline capture**

Run:

```bash
git add docs/operations/phoenix-us-rebuild-cutover.md
git commit -m "docs: capture Phoenix US rebuild baseline"
```

Expected:

- A docs-only commit records the pre-rebuild state.

### Task 4: Point `polymorph-evals` at the US Phoenix and rerun evals

**Files:**

- Inspect: `services/evals/src/config.ts`
- Inspect: `services/evals/src/runners/capability.ts`
- Inspect: `services/evals/src/runners/regression.ts`

- [ ] **Step 1: Verify `polymorph-evals` is using the US Phoenix endpoint**

Run:

```bash
railway variable list -s polymorph-evals | rg "PHOENIX_HOST|PHOENIX_PUBLIC_URL|PHOENIX_API_KEY|EVAL_RUN_MODE"
```

Expected:

- `PHOENIX_HOST` points to the internal Phoenix service and `PHOENIX_PUBLIC_URL` points to the US public domain.

- [ ] **Step 2: Trigger a capability rebuild run**

Run:

```bash
railway variable set -s polymorph-evals EVAL_RUN_MODE=capability
railway redeploy -s polymorph-evals --yes
railway logs -s polymorph-evals --build=false --lines 250
```

Expected:

- Logs show `Running capability suite`, a dataset name like `polymorph-capability-vX`, and an experiment URL.

- [ ] **Step 3: Trigger a regression rebuild run**

Run:

```bash
railway variable set -s polymorph-evals EVAL_RUN_MODE=regression
railway redeploy -s polymorph-evals --yes
railway logs -s polymorph-evals --build=false --lines 250
```

Expected:

- Logs show `Running regression suite`, a dataset name like `polymorph-regression-vX`, and an experiment URL.

- [ ] **Step 4: Restore the standard eval run mode**

Run:

```bash
railway variable set -s polymorph-evals EVAL_RUN_MODE=all
```

Expected:

- Railway accepts the env var change without errors.

- [ ] **Step 5: Commit the cutover note update**

Append this to `docs/operations/phoenix-us-rebuild-cutover.md`:

```md
## Rebuild runs

- Capability rebuild: <timestamp and experiment URL>
- Regression rebuild: <timestamp and experiment URL>
- Final `EVAL_RUN_MODE`: all
```

Then run:

```bash
git add docs/operations/phoenix-us-rebuild-cutover.md
git commit -m "docs: record Phoenix US rebuild runs"
```

Expected:

- The rebuild record is committed.

### Task 5: Validate Phoenix recreated the configuration you actually need

**Files:**

- Inspect: `services/evals/src/corpus/index.ts`
- Inspect: `services/evals/src/runners/shared.ts`
- Inspect: `docs/operations/phoenix-us-rebuild-cutover.md`

- [ ] **Step 1: Verify datasets now exist in Phoenix**

Run:

```bash
curl -sS -H "Authorization: Bearer $PHOENIX_ADMIN_SECRET" \
  https://phoenix-production-c6b5.up.railway.app/v1/datasets | jq 'map({name, recordCount})'
```

Expected:

- Output includes the rebuilt dataset names, for example `polymorph-capability-v6` and `polymorph-regression-v6`.

- [ ] **Step 2: Verify experiments are visible in the Phoenix UI**

Run:

```bash
open https://phoenix-production-c6b5.up.railway.app/projects
```

Expected:

- The Phoenix UI shows the rebuilt datasets and at least one new experiment per suite.

- [ ] **Step 3: Verify ingestion is no longer failing with `401`**

Run:

```bash
railway logs -s phoenix --http --since 1h --lines 200 --filter "@path:/v1/traces"
```

Expected:

- New trace ingestion requests are `200`/`202`, not `401`.

- [ ] **Step 4: Record the final rebuilt state**

Append this to `docs/operations/phoenix-us-rebuild-cutover.md`:

```md
## Final state

- Rebuilt datasets: <names>
- Rebuilt experiments: <URLs>
- Trace ingestion status: <healthy|still failing>
```

- [ ] **Step 5: Commit the final validation record**

Run:

```bash
git add docs/operations/phoenix-us-rebuild-cutover.md
git commit -m "docs: record Phoenix US rebuild validation"
```

Expected:

- The final rebuild validation is committed.

### Task 6: Harden the deployment so this failure mode is easier to recover from next time

**Files:**

- Modify: `docs/operations/phoenix-recovery-notes-2026-04-10.md`
- Modify: `docs/operations/phoenix-us-rebuild-cutover.md`

- [ ] **Step 1: Add a short postmortem section to the recovery notes**

Append:

```md
## Follow-up hardening

- Treat Phoenix storage as region-bound.
- Do not move the live Phoenix service across regions without an explicit storage migration plan.
- Record the intended Phoenix region and storage strategy in deployment notes before redeploying.
- After every Phoenix deploy, verify `/v1/projects` and `/v1/datasets` before updating client API keys.
```

- [ ] **Step 2: Commit the postmortem notes**

Run:

```bash
git add docs/operations/phoenix-recovery-notes-2026-04-10.md docs/operations/phoenix-us-rebuild-cutover.md
git commit -m "docs: add Phoenix rebuild hardening notes"
```

Expected:

- Docs commit created successfully.

- [ ] **Step 3: Push the branch when the rebuild is confirmed healthy**

Run:

```bash
git push -u origin codex/phoenix-us-rebuild
```

Expected:

- Remote branch is created without errors.

## Self-Review

- Spec coverage: this plan covers choosing the exact historical configuration commit, validating the checkout, rebuilding datasets/experiments on the US Phoenix, and confirming the result without restoring historical data.
- Placeholder scan: all operational steps contain exact commands, expected outcomes, and the specific files or services involved.
- Type consistency: commit/version mapping, dataset naming, and env var names match the current code in `services/evals/src/corpus/index.ts`, `services/evals/src/runners/shared.ts`, and `services/evals/src/config.ts`.
