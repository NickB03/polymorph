# Synthetic Traffic Skill

Generates 3 realistic browser sessions on polymorph.fyi daily, seeding the production evals pipeline with live traffic.

## Why this exists

The eval cron (`services/evals/src/runners/traffic-monitor.ts`) samples recent `chats` rows from Supabase and runs 9 evaluators against them. Without real user traffic, it has nothing to sample. This skill drives a headless Chromium browser through the actual UI — login, textarea, streaming response — creating authentic DB records indistinguishable from organic sessions.

## Sessions

Three sessions, two turns each, targeting different eval dimensions:

| Session                   | Turns                                                     |
| ------------------------- | --------------------------------------------------------- |
| `superconductor-research` | Room-temp superconductors → LK-99 follow-up               |
| `transformer-attention`   | Intuitive attention explanation → context window limits   |
| `ai-agent-frameworks`     | 2025 agent frameworks overview → production failure modes |

Edit `SESSIONS` in `scripts/generate-traffic.ts` to add or replace scenarios.

## Running manually

```bash
# Against production (default)
TRAFFIC_BOT_EMAIL=bot@polymorph.fyi \
TRAFFIC_BOT_PASSWORD=<secret> \
bun run traffic

# Against local dev server
POLYMORPH_URL=http://localhost:43100 \
TRAFFIC_BOT_EMAIL=... \
bun run traffic
```

## Scheduled run

`.github/workflows/synthetic-traffic.yml` fires at **14:00 UTC daily**. Secrets live in GitHub Actions repository secrets:

- `TRAFFIC_BOT_EMAIL`
- `TRAFFIC_BOT_PASSWORD`

Manual trigger: GitHub → Actions → "Synthetic Traffic" → "Run workflow".

## Setup checklist

1. Create a dedicated Polymorph account at `/auth/sign-up` (use a `+bot` alias so it's identifiable in the DB, e.g. `you+bot@gmail.com`).
2. Add `TRAFFIC_BOT_EMAIL` and `TRAFFIC_BOT_PASSWORD` as GitHub Actions secrets.
3. Playwright Chromium is installed automatically in CI (`npx playwright install --with-deps chromium`). For local runs: `npx playwright install chromium`.

## Selectors reference

All selectors come from the live source — update them here if the components change.

| Element        | Selector                               | Source                          |
| -------------- | -------------------------------------- | ------------------------------- |
| Email field    | `#email`                               | `components/login-form.tsx:128` |
| Password field | `#password`                            | `components/login-form.tsx:149` |
| Sign In button | `role=button[name="Sign In"]`          | `components/login-form.tsx:170` |
| Chat textarea  | `textarea[aria-label="Message input"]` | `components/chat-panel.tsx:331` |
| Send button    | `[aria-label="Send message"]`          | `components/chat-panel.tsx:451` |
| Stop button    | `[aria-label="Stop generating"]`       | `components/chat-panel.tsx:451` |

## Failure screenshots

On session failure the script saves a full-page screenshot to `/tmp/traffic-fail-<session-name>.png`. In GitHub Actions the `Upload failure screenshots` step uploads these as artifacts (retained 7 days).
