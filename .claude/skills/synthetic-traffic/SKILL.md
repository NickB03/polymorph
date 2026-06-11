# Synthetic Traffic Skill

Generates synthetic user sessions on polymorph.fyi to give the eval pipeline realistic chat data to sample.

## When to invoke

- When the `traffic-monitor` eval suite returns zero samples (no recent production traffic)
- When you want to manually trigger a round of sessions before an eval run
- When validating that the end-to-end eval pipeline is wired up correctly

## What it does

1. Picks 3 prompts at random from a pool of 8 research/creative/exploration themes
2. Launches a headless Chromium browser via Playwright
3. Uses Claude computer use (`claude-haiku-4-5-20251001` by default) to navigate polymorph.fyi naturally — not scripted clicks
4. Each session: navigates to the site, starts a new chat, submits the prompt, reads the response, and optionally asks a follow-up
5. Authenticated sessions (via `POLYMORPH_COOKIES`) write chats to the database; those chats are later sampled by the 48-hour Railway eval cron

## Running manually

```bash
# Run 3 sessions (default)
bun scripts/synthetic-traffic.ts

# Preview which sessions would be selected without running
SYNTHETIC_DRY_RUN=1 bun scripts/synthetic-traffic.ts

# Run a single session
SYNTHETIC_SESSIONS=1 bun scripts/synthetic-traffic.ts

# Override the target URL (e.g. local dev)
SYNTHETIC_URL=http://localhost:43100 bun scripts/synthetic-traffic.ts
```

## Required environment variables

| Variable            | Where to get it                                              |
| ------------------- | ------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Anthropic console                                            |
| `POLYMORPH_COOKIES` | DevTools → Network tab → any request → Cookie request header |

Without `POLYMORPH_COOKIES` the sessions run as guest and chats may not persist to the database.

## Automated schedule

`.github/workflows/synthetic-traffic.yml` runs daily at 14:00 UTC via GitHub Actions.
Requires `ANTHROPIC_API_KEY` and `POLYMORPH_COOKIES` set as **repository secrets** in GitHub.

To trigger a manual run from CI, use `workflow_dispatch` in the GitHub Actions UI or:

```bash
gh workflow run synthetic-traffic.yml
```

## Session pool

The script holds 8 session templates. Three are selected randomly on each run so the eval corpus stays varied:

- `llm-trends` — recent LLM/AI agent developments + follow-up
- `climate-research` — climate tipping points research
- `creative-brainstorm` — SaaS idea generation
- `quantum-explainer` — quantum vs classical computing + error correction follow-up
- `space-exploration` — commercial space / Mars timeline
- `biotech-crispr` — CRISPR gene editing and near-term treatments
- `ai-regulation` — EU AI Act + US federal policy comparison
- `web-architecture` — SSR vs CSR trade-offs with Next.js App Router

## Modifying sessions

Edit `SESSION_POOL` in `scripts/synthetic-traffic.ts`. Keep prompts directional enough that Claude can complete them in ≤20 browser steps, and varied enough to exercise different Polymorph tool paths (research, chat, creation).

## Cost

Each session costs roughly $0.02–0.10 in Anthropic API usage depending on page complexity and step count (`claude-haiku-4-5-20251001` model). Three sessions ≈ $0.06–0.30/day.
To use a cheaper or more capable model, set `SYNTHETIC_MODEL` in the workflow environment.
