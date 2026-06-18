---
name: simulate-traffic
description: 'Simulates realistic user sessions on polymorph.fyi for eval traffic generation. Runs 3 chat sessions covering search, research, and build modes to populate Phoenix traces for the traffic monitor evaluator. Schedule daily via Claude Code web scheduler.'
trigger: /simulate-traffic
---

# /simulate-traffic

Generate synthetic but realistic user sessions on polymorph.fyi. Runs 3 sessions — a quick search, a multi-step research query, and a canvas build — then optionally uses computer use to visually spot-check the site. Designed to run once per day as a scheduled Claude Code session.

## Usage

```
/simulate-traffic             # run 3 sessions against production
/simulate-traffic --dry-run  # preview today's queries without hitting the API
```

## What this skill is for

The traffic monitor evaluator in `services/evals/` samples recent chats from Supabase to judge response quality. Without real user traffic there is nothing to sample. This skill generates the minimum viable daily corpus: one session per primary mode (chat search, research agent loop, canvas build). Queries rotate via a date-based seed so the eval corpus stays diverse across days.

## Required configuration

Set these in the scheduled session environment (Claude Code web → Session → Environment variables):

| Variable            | Required | Description                                                    |
| ------------------- | -------- | -------------------------------------------------------------- |
| `POLYMORPH_COOKIES` | Yes\*    | Full `Cookie` header value copied from browser DevTools        |
| `SIMULATE_URL`      | No       | Override base URL (default: `https://polymorph.fyi`)           |

\*Without cookies, requests run as guest and may be rate-limited or not persisted to the DB for sampling.

### Getting your cookie string

1. Open https://polymorph.fyi in Chrome and sign in
2. Open DevTools → Network → trigger any `/api/chat` request
3. Click the request → Headers → Request Headers → `Cookie`
4. Copy the full value
5. Paste it as `POLYMORPH_COOKIES=<value>` in the session environment

Cookies expire with the session. Refresh them whenever you get HTTP 401 responses.

## What You Must Do When Invoked

### Step 1 — Check the script exists

```bash
ls scripts/simulate-traffic.ts
```

If missing, the file should be at `scripts/simulate-traffic.ts` on the current branch. Pull and retry. Do not proceed without it.

### Step 2 — Dry-run preview (when `--dry-run` was passed)

```bash
bun run scripts/simulate-traffic.ts --dry-run
```

Print today's three queries and exit. Do not fire any real requests.

### Step 3 — Run the sessions

```bash
bun run scripts/simulate-traffic.ts
```

This sends 3 sequential POST requests to `/api/chat`, consuming each SSE stream to completion before moving to the next. Each session is spaced 8–15 seconds apart to mimic human pacing and avoid rate-limit triggers.

Expected output per session:
```
Session 1/3  [search]
  Query:  "What programming languages should a developer learn in 2025?"
  Mode:   chat
  ChatID: 1750000000000_abc123def
  ✓ Stream complete — text events: 142, tool events: 0, done signal: true
```

### Step 4 — Handle failures

**HTTP 401 / 403**: Cookies have expired. Update `POLYMORPH_COOKIES` in the session environment and re-run.

**HTTP 429**: Rate-limited in guest mode. Ensure `POLYMORPH_COOKIES` is set with a valid authenticated session.

**Network error**: The production site may be down. Check https://polymorph.fyi in a browser and retry in 10 minutes.

**`done signal: false`**: The stream ended without a `[DONE]` event. This is usually a transient error from the AI provider. The trace was likely partially written to Phoenix — retry the full run.

### Step 5 — Report summary

After the script exits, output a concise summary:

```
Sessions completed: 3/3
  ✓ search   — "What programming languages should a developer learn in 2025?"
  ✓ research — "Research the current state of nuclear fusion energy…"
  ✓ build    — "Build a Pomodoro timer app with start, pause, and reset buttons…"
```

If any session failed, include the error and HTTP status.

### Step 6 — Visual spot-check with computer use (interactive sessions only)

Skip this step in headless cloud environments (no display server available). Only run it when you have access to screenshot and click tools.

1. Open a browser to https://polymorph.fyi
2. Take a screenshot to confirm the chat input is visible and the page loaded
3. Type a short test query: `"What is the capital of France?"`
4. Submit and wait for the streaming response to render
5. Take a screenshot of the completed response
6. Confirm: response text is visible, no blank screen, no JS error overlay
7. If the UI looks broken, note it in the summary so the user can investigate

### Step 7 — Push notification (scheduled sessions only)

When running as a scheduled routine, send a PushNotification immediately after Step 5 (whether the run succeeded or failed). Do not wait until after the visual spot-check.

Include in the notification:
- Number of sessions that succeeded vs failed
- Today's 3 queries (truncated to ~50 chars each)
- Any errors or warnings

Send the notification even if all sessions succeeded — this run exists to generate traffic and the user wants confirmation it ran.

## Query banks

Queries are seeded by `Math.floor(Date.now() / 86_400_000) % bankSize` so each day picks a different query within each bank. All banks live in `scripts/simulate-traffic.ts` and can be extended freely.

| Mode     | Bank size | Coverage                                                    |
| -------- | --------- | ----------------------------------------------------------- |
| search   | 10        | Tech, science, health, economics, AI                        |
| research | 8         | Deep technical + geopolitical topics, multi-step agent loop |
| build    | 8         | Small React apps exercising canvas artifact creation        |

## Scheduling (one-time setup)

1. Go to [claude.ai/code](https://claude.ai/code) → New Session → Scheduled
2. Schedule: daily, 03:00 UTC (off-peak, avoids prod load spikes)
3. Working directory: this repo root
4. Environment: add `POLYMORPH_COOKIES=<value>`
5. Starting prompt: `/simulate-traffic`

The evals cron (Railway, every 48h) picks up the generated sessions automatically via the traffic monitor sampler in `services/evals/sampler.ts`.

## Maintenance

- **Refresh cookies** whenever sessions return 401. Supabase auth sessions last 1 week by default.
- **Extend query banks** by appending to the arrays in `scripts/simulate-traffic.ts` — no skill changes needed.
- **Add a 4th session type** by adding a new entry to `planSessions()` in the script and documenting it here.
- **Change the target environment** by setting `SIMULATE_URL=https://staging.polymorph.fyi` in the session env.
