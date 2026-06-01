# simulate-traffic

Generates synthetic guest/authenticated user sessions on a Polymorph
deployment to build an eval traffic baseline. Each session picks a query from
a pool of 12 (across search / research / build modes), submits it to the chat
interface, and waits for the full streaming response. Resulting chat records
land in the production database and are sampled by the next eval cron run.

## Scheduling

**For persistent daily automation** (doesn't require an active session):

`.github/workflows/simulate-traffic.yml` runs at 09:00 UTC every day via
GitHub Actions. One-time setup required:

1. In Vercel dashboard → **Settings → Deployment Protection → Bypass for
   Automation**, create a bypass secret.
2. Add it as a repository secret named `POLYMORPH_BYPASS_SECRET`.
3. Optionally add `POLYMORPH_COOKIES` if you want sessions under your account.

Trigger a manual run anytime:  
`Actions → Simulate Traffic → Run workflow`

**To run now from this session:**  
Follow the steps below.

---

## Steps

### 1. Choose mode

The script auto-detects the best mode:

| Mode      | How it works                                       | Requires                                 |
| --------- | -------------------------------------------------- | ---------------------------------------- |
| `browser` | Headless Chromium via Playwright, navigates the UI | Local machine w/ Chromium                |
| `api`     | Direct POST to `/api/chat` (same as `chat-cli.ts`) | `POLYMORPH_BYPASS_SECRET` or open access |

Force a mode with `SIMULATE_MODE=api` or `SIMULATE_MODE=browser`.

### 2. Run

**API mode (works from any environment with the bypass secret):**

```bash
POLYMORPH_BYPASS_SECRET=<secret> bun run scripts/simulate-traffic.ts
```

**Browser mode (local machine with Playwright installed):**

```bash
# Install browsers once:
bunx playwright install chromium

bun run scripts/simulate-traffic.ts
```

**Against local dev server:**

```bash
SIMULATE_URL=http://localhost:43100 bun run scripts/simulate-traffic.ts
```

**More sessions:**

```bash
SIMULATE_SESSIONS=5 POLYMORPH_BYPASS_SECRET=<secret> bun run scripts/simulate-traffic.ts
```

### 3. Confirm the sessions appeared

Check that the conversations landed in the database:

```sql
-- In Supabase Studio or psql
SELECT id, created_at, search_mode
FROM chats
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Trigger eval cron (optional)

The eval cron picks up new traffic automatically every 48 hours.
To run it immediately: Railway dashboard → `polymorph-evals` → Deployments →
`⋯` → **Redeploy**.

---

## Troubleshooting

| Symptom                             | Likely cause                                         | Fix                                                                           |
| ----------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `HTTP 403: Host not in allowlist`   | Vercel Deployment Protection is blocking the request | Set `POLYMORPH_BYPASS_SECRET`                                                 |
| `waitFor: Timeout 15000ms exceeded` | Page didn't hydrate in time (browser mode)           | Try `SIMULATE_URL=http://localhost:43100` or increase timeout                 |
| `launch: Executable doesn't exist`  | Playwright can't find Chromium                       | Set `CHROMIUM_PATH=/path/to/chrome` or run `bunx playwright install chromium` |
| All sessions fail in GitHub Actions | Bypass secret not configured                         | Add `POLYMORPH_BYPASS_SECRET` to repo secrets                                 |
