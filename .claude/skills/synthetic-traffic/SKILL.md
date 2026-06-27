# Synthetic Traffic Skill

Drives 3 realistic browser sessions on polymorph.fyi to seed the eval traffic-monitor with fresh chat records. The traffic-monitor eval suite samples real chats from the last 48 hours — without organic traffic this skill manufactures that traffic so evals have something to audit.

## Trigger

User says anything like: "generate synthetic traffic", "seed traffic", "run synthetic sessions", "the traffic-monitor has nothing to sample".

## What this skill does

1. Runs `bun run synthetic-traffic` which launches headless Chromium via Playwright
2. Authenticates as the seed user via Supabase cookie injection (no UI login needed)
3. Navigates to `APP_URL` (defaults to `https://polymorph.fyi`) and submits 3 prompts that rotate by day-of-week
4. Waits for each response to finish streaming before proceeding
5. Research sessions (mode=research, model=quality) include a follow-up question to create richer multi-turn records

## How to invoke

```
APP_URL=https://polymorph.fyi \
SUPABASE_URL=<value> \
SUPABASE_ANON_KEY=<value> \
SEED_USER_EMAIL=<value> \
SEED_USER_PASSWORD=<value> \
bun run synthetic-traffic
```

Same credentials as the evals service. If env vars are already set, just run `bun run synthetic-traffic`.

For local dev: `APP_URL=http://localhost:43100 bun run synthetic-traffic`

## Session archetypes (daily rotation, 0=Sun)

| #   | Label pattern | Mode     | Model   | Follow-up? |
| --- | ------------- | -------- | ------- | ---------- |
| 1   | research-\*   | research | quality | yes        |
| 2   | tech-\*       | chat     | speed   | no         |
| 3   | general-\*    | chat     | speed   | no         |

Full prompt pool lives in `scripts/synthetic-traffic.ts` → `DAILY_SESSIONS`.

## Verification steps

After running, confirm:

- Output ends with `N/3 sessions succeeded`
- At least 2 of 3 sessions completed (1 failure is acceptable; 0 is a hard failure)
- If any session failed, check the specific error line above the summary

To confirm records were created in the DB:

```sql
SELECT chat_id, created_at, role
FROM messages
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

## How the traffic feeds evals

1. This script creates real `messages` rows in Supabase (authenticated as the seed user)
2. The `traffic-monitor` eval runner calls `sampleRecentChats()` in `services/evals/src/sampler.ts`
3. The sampler looks back `LOOKBACK_HOURS` (default 48 h) and picks up to `SAMPLE_SIZE` (default 10) chats
4. Those are replayed via `/api/evals/run` and scored by 9 evaluators
5. Results land in Phoenix and on the `/admin/evals` dashboard under "Production Evals"

Run synthetic traffic before the evals cron if you need fresh samples, or rely on the daily GitHub Actions schedule (`.github/workflows/synthetic-traffic.yml`) to keep the pipeline fed automatically.

## Daily automation

The workflow `.github/workflows/synthetic-traffic.yml` fires at 08:00 UTC every day.

Required GitHub Secrets (Settings → Secrets → Actions):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SEED_USER_EMAIL`
- `SEED_USER_PASSWORD`

`APP_URL` is hardcoded to `https://polymorph.fyi` in the workflow; change it there if the production URL ever changes.

## Troubleshooting

**"textarea not found" or "locator.waitFor: Timeout"**
The chat input selector needs updating. Open the app in DevTools, find the actual input element, then update `scripts/synthetic-traffic.ts`:

```
const textarea = page.locator('YOUR_SELECTOR').first()
```

Common alternatives: `[data-testid="chat-input"]`, `[aria-label="Message"]`, `input[type="text"]`.

**"Supabase auth failed"**
`SEED_USER_EMAIL` / `SEED_USER_PASSWORD` are wrong or the seed user does not exist in Supabase Auth. Verify with the Supabase dashboard → Authentication → Users.

**Sessions time out consistently**
The default waits are 150 s for research and 90 s for chat. If the production app is reliably slower, increase `timeout` in `runSession()` in the script.

**0/3 sessions succeeded**
Script exits with code 1. The GitHub Actions run is marked failed. Check the run logs for the first FAILED line — auth errors are reported before the browser even launches.

**Traffic-monitor still empty after running**
Check that `LOOKBACK_HOURS` in the evals service covers the time gap between traffic generation and the eval run. Default is 48 h; synthetic sessions should be picked up automatically.
