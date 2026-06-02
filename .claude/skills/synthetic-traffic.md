# synthetic-traffic

Generate synthetic production eval traffic by running 3 realistic user sessions against polymorph.fyi. Each session uses a different mode (search, research, build) and a randomly chosen query pair so repeated daily runs produce varied eval corpus entries.

## When to invoke

- Once per day (use `/loop 24h /synthetic-traffic` to automate)
- Before running an eval suite if recent traffic is sparse
- After deploying a significant agent or tool change to seed fresh samples

## Prerequisites

Set these in `.env.local` (or as Railway/Vercel env vars for CI runs):

```
SYNTHETIC_TRAFFIC_EMAIL=<polymorph account email>
SYNTHETIC_TRAFFIC_PASSWORD=<polymorph account password>
SYNTHETIC_TRAFFIC_URL=https://polymorph.fyi   # optional, defaults to prod
```

Playwright and its Chromium binary must be available:

```bash
bun add -D playwright
npx playwright install chromium --with-deps
```

## Steps

1. **Verify prerequisites**
   - Confirm `SYNTHETIC_TRAFFIC_EMAIL` and `SYNTHETIC_TRAFFIC_PASSWORD` are set (check `.env.local`)
   - If `playwright` is not in `package.json` devDependencies, install it: `bun add -D playwright`
   - If the Chromium binary is missing, run: `npx playwright install chromium --with-deps`

2. **Run the traffic script**

   ```bash
   bun scripts/synthetic-traffic.ts
   ```

   The script runs three sequential browser sessions. Each session:
   - Opens a fresh browser context and logs in
   - Sets the target mode via cookie (`searchMode=search|research|build`)
   - Navigates to the home page and submits 1–2 queries
   - Waits for each streaming response to finish before continuing
   - Closes the context

3. **Review output**
   - The script prints a summary line per session: mode, query snippet, and duration
   - On error (login failure, timeout, selector mismatch), it prints a stack trace and continues with remaining sessions
   - A non-zero exit code means at least one session failed

4. **Verify traffic reached the DB** (optional, spot-check)
   ```bash
   bun run chat -- --url http://localhost:43100  # not needed; verify via Supabase Studio
   ```
   Open Supabase Studio → Table Editor → `messages` and confirm new rows exist with `created_at` from the last few minutes.

## Session design

| #   | Mode     | Turn count | Purpose                                    |
| --- | -------- | ---------- | ------------------------------------------ |
| 1   | search   | 2          | Fast factual lookups; exercises chat agent |
| 2   | research | 2          | Deep multi-tool research loop              |
| 3   | build    | 1          | Canvas artifact generation                 |

Query pools are randomized each run. Queries intentionally span diverse topics (science, economics, history, technology) to maximize eval coverage across faithfulness, relevance, and citation-accuracy dimensions.

## Troubleshooting

- **Login redirect loop** — credentials wrong or Supabase email confirmation not done
- **Selector timeout on textarea** — page structure changed; update the `aria-label="Message input"` selector in `scripts/synthetic-traffic.ts`
- **Response timeout (120 s)** — model is slow or the site is under load; increase `RESPONSE_TIMEOUT_MS` env var or retry
- **Guest rate limit hit** — the script is not authenticated; check that `SYNTHETIC_TRAFFIC_EMAIL` is set correctly
