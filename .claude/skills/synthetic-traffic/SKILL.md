---
name: synthetic-traffic
description: Simulate 3 realistic browser sessions on polymorph.fyi to generate eval-auditable traffic. Runs Playwright headlessly, picks 3 scenarios from a 9-scenario rotating corpus, and submits multi-turn conversations exactly as a user would.
trigger: /synthetic-traffic
---

# Synthetic Traffic Skill

Drives a headless Chromium browser through 3 chat sessions on polymorph.fyi, generating real DB entries that the traffic-monitor eval suite can sample.

## Usage

```
/synthetic-traffic               — 3 sessions, today's scenario rotation, production URL
/synthetic-traffic --local       — run against http://localhost:43100 instead
/synthetic-traffic --all         — run all 9 scenarios (full corpus)
/synthetic-traffic --dry-run     — print today's scenarios without running the browser
```

## Steps

### 1. Check prerequisites

```bash
# Playwright installed?
bunx playwright --version 2>/dev/null || echo "Run: bunx playwright install chromium --with-deps"

# Credentials configured? (guest mode is the fallback)
echo "Auth mode: ${SYNTHETIC_USER_EMAIL:+credentials}${SYNTHETIC_USER_EMAIL:-guest}"
```

### 2. Run the sessions

```bash
# Standard run (production)
bun scripts/synthetic-traffic/index.ts

# Against local dev server
POLYMORPH_URL=http://localhost:43100 bun scripts/synthetic-traffic/index.ts

# With explicit credentials
SYNTHETIC_USER_EMAIL=test@example.com \
SYNTHETIC_USER_PASSWORD=yourpassword \
bun scripts/synthetic-traffic/index.ts

# All 9 scenarios
ALL_SCENARIOS=1 bun scripts/synthetic-traffic/index.ts
```

Exit code 0 = all sessions passed. Exit code 1 = one or more sessions failed (partial success is still logged).

### 3. Verify traffic was recorded

After a successful run, confirm messages landed in the DB:

```bash
# Recent messages from the last 10 minutes (requires DB access)
bun run scripts/chat-cli.ts  # or query Supabase Studio at localhost:44323
```

### 4. Trigger a traffic-monitor eval (optional)

```bash
cd services/evals
EVAL_RUN_MODE=traffic-monitor bun run src/index.ts
```

---

## Scheduling

Runs automatically via **GitHub Actions** at **15:00 UTC daily**.
See `.github/workflows/synthetic-traffic.yml`.

Manual triggers:

- GitHub UI: Actions → Synthetic Traffic → Run workflow
- CLI: `gh workflow run synthetic-traffic.yml`
- With a different URL: pass `url` input in the workflow dispatch dialog

---

## One-time setup

If sessions are failing because guest mode is disabled:

1. Create a dedicated test account at https://polymorph.fyi/auth/sign-up
2. Add these **GitHub Secrets** (Settings → Secrets → Actions):
   - `SYNTHETIC_USER_EMAIL`
   - `SYNTHETIC_USER_PASSWORD`

The account's messages will be picked up by the eval sampler just like real user traffic.

---

## Scenario corpus

9 scenarios in 3 personas, defined in `scripts/synthetic-traffic/scenarios.ts`.
3 are selected per day via a deterministic date-seeded shuffle — same day always produces the same 3.

| ID                     | Name                           |
| ---------------------- | ------------------------------ |
| `dev-rate-limiting`    | Developer: Rate Limiting       |
| `dev-typescript`       | Developer: TypeScript Patterns |
| `dev-performance`      | Developer: Next.js Performance |
| `research-tls`         | Researcher: HTTPS & TLS        |
| `research-rag`         | Researcher: RAG vs Fine-tuning |
| `research-security`    | Researcher: Web Security       |
| `explorer-databases`   | Explorer: Database Choices     |
| `explorer-deployment`  | Explorer: Deployment Options   |
| `explorer-distributed` | Explorer: Distributed Systems  |

To add scenarios: edit `SCENARIOS` in `scripts/synthetic-traffic/scenarios.ts`. Each entry needs an `id`, `name`, and `turns` array (2–3 messages that form a natural conversation arc).
