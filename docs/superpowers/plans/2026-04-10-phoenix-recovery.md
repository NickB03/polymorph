# Phoenix Data Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original Phoenix SQLite data volume to the `phoenix` Railway service, recover historical traces/evals, and reestablish authenticated ingestion from Vercel and `polymorph-evals`.

**Architecture:** The current `phoenix` deployment is running on a fresh empty database because the April 8 Railway deployment came up without the `/data` volume mount. Recovery should reattach the existing detached Railway volume at `/data`, redeploy Phoenix, verify the restored data is visible, then rotate or reapply the correct Phoenix API key to all clients. The plan avoids writing to the detached volume until attachment is restored and validated.

**Tech Stack:** Railway CLI, Phoenix REST/GraphQL APIs, Vercel environment variables, self-hosted Phoenix on Railway volume-backed SQLite

---

### Task 1: Freeze State And Record Evidence

**Files:**

- Reference: `docs/operations/DEPLOYMENT.md`
- Create: `docs/operations/phoenix-recovery-notes-2026-04-10.md`

- [ ] **Step 1: Record the current broken state**

Run:

```bash
railway deployment list --service phoenix --json > /tmp/phoenix-deployments.json
railway volume list --json > /tmp/phoenix-volumes.json
railway variable list -s phoenix --json > /tmp/phoenix-vars.json
```

Expected: three JSON files exist locally with current Railway deployment, volume, and env metadata.

- [ ] **Step 2: Capture live Phoenix counts before recovery**

Run:

```bash
railway run -s phoenix sh -lc 'curl -fsS -H "Authorization: Bearer $PHOENIX_ADMIN_SECRET" "https://$RAILWAY_PUBLIC_DOMAIN/v1/projects" | jq .' > /tmp/phoenix-projects-before.json
railway run -s phoenix sh -lc 'curl -fsS -H "Authorization: Bearer $PHOENIX_ADMIN_SECRET" -H "Content-Type: application/json" --data-binary "{\"query\":\"{ projectCount datasetCount promptCount evaluatorCount }\"}" "https://$RAILWAY_PUBLIC_DOMAIN/graphql" | jq .' > /tmp/phoenix-counts-before.json
```

Expected: `projectCount` is `1`, `datasetCount` is `0`, `evaluatorCount` is `0`, and only the default project is present.

- [ ] **Step 3: Save operator notes in the repo**

Create `docs/operations/phoenix-recovery-notes-2026-04-10.md` with:

```md
# Phoenix Recovery Notes (2026-04-10)

- Active deployment: `97023f65-4112-4eab-badb-8801ef235c56`
- Deployment timestamp: `2026-04-08 19:21:45 -05:00`
- Active deployment volume mounts: `[]`
- Detached volume: `phoenix-volume`
- Detached volume mount path: `/data`
- Detached volume size used: `~518MB`
- Live Phoenix state before recovery:
  - `projectCount=1`
  - `datasetCount=0`
  - `promptCount=0`
  - `evaluatorCount=0`
  - Seeded users recreated around `2026-04-08 19:22 -05:00`
- Hypothesis: Phoenix booted against a new empty DB because the `/data` mount was lost on deploy.
```

- [ ] **Step 4: Commit the investigation notes**

Run:

```bash
git add docs/operations/phoenix-recovery-notes-2026-04-10.md docs/superpowers/plans/2026-04-10-phoenix-recovery.md
git commit -m "docs: add phoenix recovery runbook"
```

Expected: a docs-only commit exists so the recovery timeline is preserved separately from the operational fix.

### Task 2: Reattach The Existing Phoenix Volume

**Files:**

- Reference: `docs/operations/DEPLOYMENT.md`

- [ ] **Step 1: Verify the volume is still detached before making changes**

Run:

```bash
railway volume list --json | jq '.volumes[] | {name, serviceName, mountPath, currentSizeMB}'
```

Expected: `phoenix-volume` shows `serviceName: null` and `mountPath: "/data"`.

- [ ] **Step 2: Attach the detached volume to the `phoenix` service**

Run:

```bash
railway volume attach -v phoenix-volume -y
```

Expected: Railway confirms the volume is attached to the currently linked `phoenix` service.

- [ ] **Step 3: Verify the attachment took effect**

Run:

```bash
railway volume list --json | jq '.volumes[] | select(.name=="phoenix-volume")'
railway deployment list --service phoenix --json | jq '.[0] | {id, createdAt, volumeMounts: .meta.volumeMounts}'
```

Expected: the volume now shows `serviceName: "phoenix"` and the next deployment should report `volumeMounts: ["/data"]`.

- [ ] **Step 4: Redeploy Phoenix after attachment**

Run:

```bash
railway redeploy -s phoenix
```

Expected: Railway starts a new deployment for `phoenix`.

- [ ] **Step 5: Wait for the deployment to succeed**

Run:

```bash
railway deployment list --service phoenix --json | jq '.[0] | {id, status, createdAt, volumeMounts: .meta.volumeMounts}'
```

Expected: latest deployment status is `SUCCESS` and `volumeMounts` contains `"/data"`.

### Task 3: Validate Historical Data Restoration

**Files:**

- Reference: `docs/operations/DEPLOYMENT.md`

- [ ] **Step 1: Recheck Phoenix project and dataset counts**

Run:

```bash
railway run -s phoenix sh -lc 'curl -fsS -H "Authorization: Bearer $PHOENIX_ADMIN_SECRET" "https://$RAILWAY_PUBLIC_DOMAIN/v1/projects" | jq .' > /tmp/phoenix-projects-after.json
railway run -s phoenix sh -lc 'curl -fsS -H "Authorization: Bearer $PHOENIX_ADMIN_SECRET" -H "Content-Type: application/json" --data-binary "{\"query\":\"{ projectCount datasetCount promptCount evaluatorCount }\"}" "https://$RAILWAY_PUBLIC_DOMAIN/graphql" | jq .' > /tmp/phoenix-counts-after.json
```

Expected: counts increase above the pre-recovery baseline and old projects/datasets reappear.

- [ ] **Step 2: Check experiments through the UI-facing API**

Run:

```bash
railway run -s phoenix sh -lc 'curl -fsS -H "Authorization: Bearer $PHOENIX_ADMIN_SECRET" "https://$RAILWAY_PUBLIC_DOMAIN/v1/datasets" | jq .' > /tmp/phoenix-datasets-after.json
```

Expected: previously missing eval datasets are present.

- [ ] **Step 3: Verify the restored state is not just empty auth**

Run:

```bash
railway run -s phoenix sh -lc 'curl -fsS -H "Authorization: Bearer $PHOENIX_ADMIN_SECRET" "https://$RAILWAY_PUBLIC_DOMAIN/v1/users" | jq .' > /tmp/phoenix-users-after.json
```

Expected: user records may differ from the temporary recovery state if the original DB was restored.

- [ ] **Step 4: Sanity check through the Phoenix UI**

Manual check:

```text
Open https://phoenix-production-c6b5.up.railway.app
Verify historical traces appear under Tracing
Verify datasets/experiments count is no longer zero
Verify old eval suites are visible again
```

Expected: the UI matches the restored API data.

- [ ] **Step 5: Stop and escalate if counts remain zero**

Run:

```bash
diff -u /tmp/phoenix-counts-before.json /tmp/phoenix-counts-after.json || true
```

Expected: if there is no meaningful difference, stop here. Do not rotate keys yet. The remaining problem is likely wrong volume attachment, wrong service, or volume corruption and needs deeper Railway inspection.

### Task 4: Restore Authenticated Ingestion

**Files:**

- Reference: `docs/operations/DEPLOYMENT.md`

- [ ] **Step 1: Create or confirm the correct Phoenix system API key in the restored UI**

Manual step:

```text
Phoenix UI → Settings → API Keys → create a System API key if the original key is missing or invalid
```

Expected: a valid Phoenix system API key exists for trace ingestion and eval uploads.

- [ ] **Step 2: Update Railway evals service with the valid Phoenix API key**

Run:

```bash
railway variable set PHOENIX_API_KEY=<restored-or-new-system-api-key> -s polymorph-evals
```

Expected: `polymorph-evals` now uses the live Phoenix key from the restored instance.

- [ ] **Step 3: Update Vercel production with the same Phoenix API key**

Manual step:

```text
Vercel → Project Settings → Environment Variables
Set PHOENIX_API_KEY for Production to the restored Phoenix system API key
Confirm PHOENIX_COLLECTOR_ENDPOINT remains https://phoenix-production-c6b5.up.railway.app
```

Expected: the app points at the restored Phoenix instance with valid auth.

- [ ] **Step 4: Verify traces stop returning 401**

Run:

```bash
railway logs -s phoenix --http --since 15m --lines 100 --filter "@path:/v1/traces"
```

Expected: new `/v1/traces` responses move from `401` to `200` or another success status used by Phoenix ingestion.

- [ ] **Step 5: Verify eval uploads can authenticate**

Run:

```bash
railway logs -s phoenix --http --since 15m --lines 100 --filter "@path:/v1/datasets OR @path:/v1/experiments"
```

Expected: no new `401` responses for eval dataset or experiment writes.

### Task 5: Post-Recovery Hardening

**Files:**

- Modify: `docs/operations/DEPLOYMENT.md`

- [ ] **Step 1: Document the Railway mount dependency explicitly**

Update `docs/operations/DEPLOYMENT.md` to add an operator note under the Phoenix service section:

```md
> **Critical:** The `phoenix` service must have the Railway volume mounted at `/data`. If a deployment shows `volumeMounts: []` or the volume becomes detached, Phoenix will boot with a fresh empty SQLite database and historical traces/evals will disappear from the UI even though the old volume may still exist.
```

- [ ] **Step 2: Add a verification command for operators**

Add this snippet to the same document:

````md
Verify the active Phoenix deployment still has the volume attached:

```bash
railway deployment list --service phoenix --json | jq '.[0] | {id, status, volumeMounts: .meta.volumeMounts}'
railway volume list --json | jq '.volumes[] | select(.name=="phoenix-volume")'
```
````

````

- [ ] **Step 3: Record the final recovery outcome**

Append to `docs/operations/phoenix-recovery-notes-2026-04-10.md`:

```md
## Outcome

- Volume reattached: yes/no
- Restored historical traces: yes/no
- Restored eval datasets: yes/no
- New Phoenix API key issued: yes/no
- Vercel updated: yes/no
- polymorph-evals updated: yes/no
- Remaining follow-up:
````

- [ ] **Step 4: Commit the hardening docs**

Run:

```bash
git add docs/operations/DEPLOYMENT.md docs/operations/phoenix-recovery-notes-2026-04-10.md
git commit -m "docs: harden phoenix volume recovery guidance"
```

Expected: the operator guidance now prevents this specific outage mode from recurring silently.

### Task 6: Recovery Verification Checklist

**Files:**

- Reference: `docs/operations/DEPLOYMENT.md`

- [ ] **Step 1: Confirm Railway volume + deployment state**

Run:

```bash
railway volume list --json | jq '.volumes[] | select(.name=="phoenix-volume")'
railway deployment list --service phoenix --json | jq '.[0] | {status, volumeMounts: .meta.volumeMounts}'
```

Expected: `serviceName` is `phoenix` and `volumeMounts` contains `"/data"`.

- [ ] **Step 2: Confirm Phoenix historical data is back**

Run:

```bash
cat /tmp/phoenix-counts-after.json
```

Expected: counts are materially above zero for the previously missing data classes.

- [ ] **Step 3: Confirm ingestion is healthy**

Run:

```bash
railway logs -s phoenix --http --since 30m --lines 200 --filter "@path:/v1/traces"
```

Expected: no sustained stream of `401` responses.

- [ ] **Step 4: Confirm the evals cron can still reach Phoenix privately**

Run:

```bash
railway variable list -s polymorph-evals --json | jq '{PHOENIX_HOST, PHOENIX_PUBLIC_URL}'
```

Expected: `PHOENIX_HOST` remains `http://phoenix.railway.internal:6006` and public URL remains the Railway HTTPS domain.

- [ ] **Step 5: Commit any remaining operational notes**

Run:

```bash
git status
```

Expected: only intentional docs changes remain, or the tree is clean.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-10-phoenix-recovery.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
