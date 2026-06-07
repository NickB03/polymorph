# generate-traffic

Simulate realistic user sessions on polymorph.fyi to generate production traffic for eval auditing.

**Usage:** `/generate-traffic`

## When to use

- Before running the eval suite when production traffic is sparse
- On a daily schedule to keep the traffic-monitor eval suite well-fed
- Run as: `/loop 24h /generate-traffic` for continuous daily execution

## What it does

Runs 3 distinct user sessions against polymorph.fyi. Each session has 2 turns covering
a different topic area and search/model configuration, producing varied data for the
traffic-monitor evaluator.

| Session   | Mode     | Model   | Topic area                 |
| --------- | -------- | ------- | -------------------------- |
| Research  | research | quality | Science / current events   |
| Technical | chat     | speed   | Engineering / dev tools    |
| Curiosity | research | speed   | Health / lifestyle science |

## Instructions

### Option A — Computer use (interactive, recommended for one-off runs)

1. Open a browser to polymorph.fyi:
   ```bash
   chromium --no-sandbox https://polymorph.fyi &
   # or: open https://polymorph.fyi
   ```
2. Take a screenshot to confirm the page loaded and the chat input is visible.
3. For **each** of the three sessions below, in order:
   a. Navigate to a new chat (reload the page or click "New chat" in the sidebar).
   b. If the mode selector is visible, set the search and model modes matching the session.
   c. Click the chat textarea.
   d. Type the **first turn** query exactly as written.
   e. Press **Enter** and wait for the full assistant response to finish streaming
   (the stop button disappears and the send button reappears).
   f. Type the **second turn** query.
   g. Press **Enter** and wait for the full response.
   h. Note the chat ID from the browser URL bar.
4. After all three sessions, report the three chat IDs so they can be verified in the DB.

---

### Session 1 — Research

**Search mode:** research **Model:** quality

> **Turn 1:** What are the latest breakthroughs in nuclear fusion energy research, and when might commercial fusion power realistically become viable?

> **Turn 2:** What are the main remaining engineering challenges preventing commercial fusion reactors from being deployed at scale?

---

### Session 2 — Technical

**Search mode:** chat **Model:** speed

> **Turn 1:** Explain the key architectural differences between React Server Components and Client Components, and describe the decision criteria for choosing one over the other.

> **Turn 2:** How does streaming SSR differ from traditional SSR in Next.js, and what are the concrete performance tradeoffs?

---

### Session 3 — Curiosity

**Search mode:** research **Model:** speed

> **Turn 1:** What does current scientific research say about the relationship between sleep quality and long-term cognitive health?

> **Turn 2:** Which evidence-based practices most reliably improve deep sleep according to recent studies?

---

### Option B — Headless script (for scheduled / CI runs)

```bash
bun run generate-traffic
```

Requires environment variables:

- `TRAFFIC_TARGET_URL` — target site (default: `https://polymorph.fyi`)
- `POLYMORPH_COOKIES` — your session cookie string (required for sessions to persist to the DB and be sampled by the eval system; guest sessions are not sampled)

To get `POLYMORPH_COOKIES`: open DevTools → Network → make any request → copy the full `Cookie` header value → add to `.env.local`.

## Scheduling daily runs

```
/loop 24h /generate-traffic
```

Or via GitHub Actions (see `.github/workflows/generate-traffic.yml`): set the
`POLYMORPH_COOKIES` secret in the repo and the workflow fires automatically at 14:00 UTC.

## Troubleshooting

- **Sessions not appearing in eval samples:** Confirm `POLYMORPH_COOKIES` contains a valid auth token. The sampler queries the `messages` table which is RLS-gated to authenticated users.
- **Rate-limited / 429 errors:** The script inserts a 10-second pause between sessions. Increase `SESSION_PAUSE_MS` in `scripts/generate-traffic.ts` if needed.
- **Playwright browser not found:** Run `bunx playwright install chromium` once after `bun install`.
