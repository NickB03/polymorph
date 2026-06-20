---
name: synthetic-traffic
description: Simulate realistic user sessions on polymorph.fyi using Claude computer use + Playwright, to generate eval traffic.
trigger: /synthetic-traffic
---

# Synthetic Traffic Generator

Runs `N` (default 3) realistic 2-turn conversations per day on polymorph.fyi using a Claude computer-use agent driving a real Chromium browser. Sessions are fully persisted to Supabase, so the evals traffic-monitor sampler picks them up in the next 48-hour cron run.

## When to invoke

- User asks to "run synthetic traffic", "generate eval sessions", or "simulate user traffic"
- Scheduled daily run (GitHub Actions cron, see below)
- After a deploy, to seed fresh traffic before the next eval window

## Execution steps

### 1. Verify prerequisites

```bash
# Playwright must be installed
bun add playwright --dev          # only needed once; already in devDependencies
npx playwright install chromium --with-deps
```

### 2. Set required environment variables

| Variable                | Required | Notes                                                                        |
| ----------------------- | -------- | ---------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`     | **Yes**  | Reuse the project key; computer-use charges ~$3 of input tokens per full run |
| `SYNTH_TRAFFIC_COOKIES` | **Yes**  | Auth cookie string from the browser. Falls back to `POLYMORPH_COOKIES`.      |
| `SYNTH_TARGET_URL`      | No       | Defaults to `https://polymorph.fyi`                                          |
| `SYNTH_HEADLESS`        | No       | Set `false` to watch the browser (useful for debugging)                      |
| `SYNTH_SESSION_COUNT`   | No       | Sessions per run, default `3`                                                |

**Getting auth cookies** (one-time, refresh when sessions expire):

1. Open polymorph.fyi in Chrome → DevTools → Network tab
2. Send any message → click the `/api/chat` request
3. Copy the full `Cookie:` header value
4. Store as `SYNTH_TRAFFIC_COOKIES` in GitHub Actions secrets

### 3. Run

```bash
# Standard run (3 sessions, headless)
bun run synthetic-traffic

# Debug: watch the browser
SYNTH_HEADLESS=false bun run synthetic-traffic

# Override count for testing
SYNTH_SESSION_COUNT=1 bun run synthetic-traffic
```

### 4. Verify capture

Sessions land in `chats` + `messages` tables immediately. The evals pipeline samples from the last N hours on its next 48-hour cron cycle. You can check the admin dashboard once it runs:

```
https://polymorph.fyi/admin/evals
```

## Scheduling (GitHub Actions — primary)

The workflow at `.github/workflows/synthetic-traffic.yml` runs daily at 14:00 UTC. It uses two repository secrets:

- `ANTHROPIC_API_KEY`
- `SYNTH_TRAFFIC_COOKIES`

To trigger manually: **Actions → Synthetic Traffic → Run workflow**.

## Session pool

The script picks `SESSION_COUNT` sessions at random from a pool of 10 topic clusters, ensuring varied coverage across eval dimensions on each run:

| Session                 | Mode     | Model   | First turn topic              |
| ----------------------- | -------- | ------- | ----------------------------- |
| `ai-safety`             | research | quality | AI safety developments        |
| `crispr-ethics`         | chat     | speed   | Gene editing mechanics        |
| `ev-batteries`          | research | speed   | Solid-state battery companies |
| `climate-capture`       | research | speed   | Direct air capture tech       |
| `transformer-explainer` | chat     | speed   | Self-attention mechanics      |
| `quantum-computing`     | research | quality | Fault-tolerant QC hardware    |
| `geo-economics`         | research | speed   | Germany vs Japan divergence   |
| `longevity-science`     | chat     | speed   | Biology of aging              |
| `semiconductor-supply`  | research | quality | TSMC/Samsung capacity         |
| `space-economy`         | research | speed   | Commercial space revenue      |

### Adding sessions

Add entries to `SESSION_POOL` in `scripts/synthetic-traffic.ts`. Keep turns to exactly 2 (initial + follow-up) so they fit in the sampler's conversation window. Mix `chat`/`research` modes and `speed`/`quality` model types to exercise all evaluators.

## How it works

```
for each session:
  launch Chromium (headless)
  set auth cookies + modelType/searchMode preference cookies
  navigate to TARGET_URL
  run computer-use agent loop:
    → take screenshot
    → send to Claude API (computer_20250124 tool, claude-sonnet-4-6)
    → Claude decides: click / type / key / scroll / screenshot
    → Playwright executes the action
    → loop until Claude replies "DONE"
  close browser
```

Each session produces real authenticated DB rows — not synthetic fixtures — so they exercise the full app stack (streaming, tool calls, DB persistence) and pass all sampler validations.

## Cost estimate

| Component                                                  | Est. per run |
| ---------------------------------------------------------- | ------------ |
| Claude computer-use (3 sessions × ~15 steps × screenshots) | ~$1.50–$3.00 |
| Browser runtime (CI minutes)                               | ~15 min      |

Running once per day: ~$45–$90/month in API cost.
