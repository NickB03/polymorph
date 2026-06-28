---
name: synthetic-traffic
description: 'Generate 3 synthetic user sessions on polymorph.fyi for eval traffic auditing'
trigger: /synthetic-traffic
---

# /synthetic-traffic

Runs `scripts/synthetic-traffic.ts` — a Claude computer use agent driving a headless Chromium browser through 3 realistic user sessions on polymorph.fyi. Sessions create real `chats` + `messages` rows in the production DB, giving the eval sampler (in `services/evals/`) meaningful traffic to audit.

## What it generates

Three back-to-back sessions (different browser contexts, same account):

| #   | Persona         | Topics                                          |
| --- | --------------- | ----------------------------------------------- |
| 1   | Researcher      | AI/LLM developments, safety, reasoning models   |
| 2   | Developer       | TypeScript/React patterns, system design        |
| 3   | Curious learner | Science, history, economics — anything non-tech |

Each session: login → new chat → 2–3 message turns → done. Sessions are isolated browser contexts so cookies don't bleed between them.

## Prerequisites

Three env vars must be set before running:

```
ANTHROPIC_API_KEY       — Claude API key (uses claude-opus-4-8 with computer use beta)
TRAFFIC_BOT_EMAIL       — Email of a Polymorph account (creates chats under this user)
TRAFFIC_BOT_PASSWORD    — Password for that account
```

Optional:

```
TRAFFIC_BOT_URL              — Override base URL (default: https://polymorph.fyi)
CHROMIUM_EXECUTABLE_PATH     — Override Chromium binary (default: auto-detect)
```

## Running manually

```bash
ANTHROPIC_API_KEY=sk-ant-... \
TRAFFIC_BOT_EMAIL=bot@example.com \
TRAFFIC_BOT_PASSWORD=... \
bun run scripts/synthetic-traffic.ts
```

In the Claude Code remote environment, Chromium is pre-installed at `/opt/pw-browsers/chromium`. Set:

```bash
CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium
```

## Scheduled run (GitHub Actions)

`.github/workflows/synthetic-traffic.yml` runs daily at 14:00 UTC.

**One-time setup — add these three GitHub Actions secrets:**

1. Go to Settings → Secrets and variables → Actions
2. Add `ANTHROPIC_API_KEY`, `TRAFFIC_BOT_EMAIL`, `TRAFFIC_BOT_PASSWORD`

The workflow only fires on pushes to `main`, so the cron won't run on branches.

**Trigger immediately** (without waiting for the schedule):

- Actions tab → "Synthetic Traffic" → Run workflow → Run workflow

## Monitoring results

After a run, verify sessions landed in the DB:

```sql
SELECT c.id, c.title, c.created_at, count(m.id) as message_count
FROM chats c
JOIN messages m ON m.chat_id = c.id
JOIN auth.users u ON u.id = c.user_id
WHERE u.email = '<TRAFFIC_BOT_EMAIL>'
  AND c.created_at > now() - interval '2 hours'
GROUP BY c.id
ORDER BY c.created_at DESC;
```

The eval sampler in `services/evals/src/sampler.ts` picks up sessions within its `lookbackHours` window (configured in `services/evals/src/config.ts`).

## Adjusting sessions

Edit the `SESSIONS` array in `scripts/synthetic-traffic.ts`:

- Change `label` for logging
- Rewrite `prompt` to shift persona or topic
- Add entries to generate more sessions per run

The `prompt` should end with an explicit stop condition ("stop after two assistant responses") — without it, the computer use agent may keep exploring indefinitely.

## Cost estimate

~3 sessions × ~25 steps × `claude-opus-4-8` ≈ $1–3 per daily run depending on screenshot sizes and response lengths.
