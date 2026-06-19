# Synthetic Traffic Skill

## Purpose

Generates realistic authenticated user traffic on polymorph.fyi so the evals
system has production chats to sample from. Three Claude computer-use sessions
run daily in a headless Playwright browser — each one navigates the live app
and conducts a natural multi-turn conversation, creating chats that land in the
DB under the seed user and are picked up by the traffic-monitor sampler within
its 48-hour lookback window.

## How to invoke

**Manual run:**

```bash
bun run scripts/synthetic-traffic.ts
```

**Trigger the workflow without waiting for the schedule:**
Go to GitHub → Actions → Synthetic Traffic → Run workflow.

**Automatic:** runs every day at 14:00 UTC via
`.github/workflows/synthetic-traffic.yml`.

**Local dev against a running dev server:**

```bash
APP_URL=http://localhost:43100 bun run scripts/synthetic-traffic.ts
```

Add `headless: false` in `scripts/synthetic-traffic.ts` (the `chromium.launch`
call) to watch the browser during debugging.

## Required env vars

| Variable             | Where to get it                                               |
| -------------------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Anthropic console → GitHub secret `ANTHROPIC_API_KEY`         |
| `SEED_USER_EMAIL`    | Same seed user as evals → GitHub secret                       |
| `SEED_USER_PASSWORD` | Same seed user as evals → GitHub secret                       |
| `SUPABASE_URL`       | Supabase project settings → GitHub secret `SUPABASE_URL`      |
| `SUPABASE_ANON_KEY`  | Supabase project settings → GitHub secret `SUPABASE_ANON_KEY` |
| `APP_URL`            | Hardcoded to `https://polymorph.fyi` in the workflow          |

Note: `SUPABASE_URL` here is the project REST URL (not the `NEXT_PUBLIC_` variant),
matching the convention in `services/evals/src/config.ts`.

## Architecture

```
scripts/synthetic-traffic.ts
│
├─ authenticate()          Supabase SSR signInWithPassword → CookieStore
│                          (credentials never enter Claude's context)
│
├─ Playwright launch       headless Chromium, inject auth cookies for the domain
│
└─ for each Session (×3)
     runSession(page, session)
     │
     └─ computer-use loop  claude-sonnet-4-6 + computer_20250124 tool
           ┌─ take screenshot → send to Claude
           ├─ Claude returns tool_use actions (click / type / scroll / …)
           ├─ executeAction() runs action in Playwright + returns new screenshot
           └─ repeat until stop_reason === 'end_turn' or step cap (40)
```

## Sessions

| ID             | Persona               | Turns                                 |
| -------------- | --------------------- | ------------------------------------- |
| `researcher`   | Curious researcher    | initial question + 2 follow-ups       |
| `student`      | University student    | conceptual question + 1 clarification |
| `professional` | Business professional | strategic question + 1 follow-up      |

## Debugging failures

- **Auth error** — check `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` match the
  Supabase project in production (not local).
- **Page never loads** — confirm `APP_URL` resolves and the seed user's cookies
  are accepted by the production auth middleware.
- **Session hits step cap** — the AI may be waiting for a slow response; try
  increasing `MAX_STEPS` in the script or adding an explicit `waitForTimeout`
  after submitting a message.
- **No chats appearing in evals** — the seed user may differ between the traffic
  script and the evals sampler query. Both should use the same Supabase project
  and the same seed user account.
- **Script exits 1** — all three sessions failed; check the logs above the exit
  for per-session error messages.
