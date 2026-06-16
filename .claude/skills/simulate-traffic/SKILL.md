# simulate-traffic

Generates realistic user sessions on polymorph.fyi to feed the traffic-monitor eval suite.
Run once per day to ensure there is always recent chat data for the evals pipeline to sample.

## Trigger

`/simulate-traffic` — or when the user says "generate eval traffic", "simulate user sessions",
"warm up evals", "run daily sessions", or "not enough eval traffic".

## What the agent does

1. Run `bun run traffic-sim` (or `bun scripts/simulate-traffic.ts` directly)
2. The script authenticates, runs 3 chat sessions against the live API, and exits
3. Report the session summary back to the user

The script rotates through query pools keyed on the day-of-year so each daily run covers
different topics automatically — no manual query selection needed.

## Sessions

Each session is 2 turns (initial question + follow-up). The 3 sessions intentionally vary
`searchMode` to exercise different eval evaluators:

| #   | Name        | searchMode | Purpose                                         |
| --- | ----------- | ---------- | ----------------------------------------------- |
| 1   | Research    | research   | Faithfulness, citation accuracy, tool selection |
| 2   | Explanation | chat       | Response quality, relevance (no web search)     |
| 3   | Analysis    | research   | Reasoning, structure, tool usage                |

### Session 1 — Research (searchMode: research)

Query pool (rotated daily):

- "What are the most significant AI research breakthroughs in the past few months?"
- "What's the current state of nuclear fusion energy and which organizations are leading the field?"
- "How has the global EV market evolved and what are the key trends heading into 2025?"
- "What are the recent developments in quantum computing and what is the realistic timeline to practical use?"
- "What is the current status of large language model research — what problems are researchers focused on?"
- "How has the geopolitics of semiconductor manufacturing changed in the past two years?"

Follow-up: "What are the biggest remaining challenges in this space?"

### Session 2 — Explanation (searchMode: chat)

Query pool:

- "Explain how attention mechanisms work in transformer neural networks"
- "How does public key cryptography work? Explain from first principles"
- "What is retrieval-augmented generation and why does it matter for LLM applications?"
- "Explain the CAP theorem and its practical implications for distributed system design"
- "How do diffusion models generate images? Explain the process conceptually"
- "What is the difference between process memory and virtual memory in operating systems?"

Follow-up: "Can you give a concrete real-world example of this in practice?"

### Session 3 — Analysis (searchMode: research)

Query pool:

- "What are the tradeoffs between SQL and NoSQL databases, and when would you choose each?"
- "Compare edge computing vs cloud computing — when does each approach make more sense?"
- "Analyze the tradeoffs between REST APIs and GraphQL for a modern web application"
- "What are the key differences between batch processing and stream processing, and when does each apply?"
- "Compare monolithic vs microservice architecture. When does the transition make sense?"
- "What are the tradeoffs between client-side, server-side, and static rendering for web apps?"

Follow-up: "How would this decision change for a small startup building their first product?"

## Required environment variables

Set these in Claude Code on the web → Environment settings (or in `.env.local` for local runs):

| Variable                        | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `POLYMORPH_TRAFFIC_EMAIL`       | Polymorph account email to use for simulated sessions  |
| `POLYMORPH_TRAFFIC_PASSWORD`    | Password for that account                              |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL (already set for app development) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (already set for app development)    |
| `POLYMORPH_BASE_URL`            | (optional) Defaults to `https://polymorph.fyi`         |

The `POLYMORPH_TRAFFIC_EMAIL` account should be a real Polymorph account (not guest) so that
chats persist to Supabase and are picked up by `services/evals/src/sampler.ts`.

## How the sampler picks these up

The traffic-monitor eval suite (`services/evals/src/runners/traffic-monitor.ts`) queries the
`messages` table for the last 48 hours via `sampler.ts`. It requires:

- `uiMessage IS NOT NULL` on both user and assistant messages (populated by the chat API)
- No canvas or generateImage tool calls (the query pools above avoid triggering these)
- At least one user→assistant exchange per chat

Sessions from this script will appear in the next evals run (Railway cron, every 48 hours).

## Scheduling (running daily)

### Option A: Claude Code on the web scheduled session (recommended)

Set up a daily triggered session in Claude Code on the web that runs `/simulate-traffic`.

### Option B: GitHub Action

```yaml
# .github/workflows/daily-traffic.yml
name: Daily eval traffic
on:
  schedule:
    - cron: '0 14 * * *' # 2pm UTC daily
  workflow_dispatch:

jobs:
  simulate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run traffic-sim
        env:
          POLYMORPH_TRAFFIC_EMAIL: ${{ secrets.POLYMORPH_TRAFFIC_EMAIL }}
          POLYMORPH_TRAFFIC_PASSWORD: ${{ secrets.POLYMORPH_TRAFFIC_PASSWORD }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

### Option C: Run on-demand via /loop

```
/loop 24h /simulate-traffic
```

## Computer use fallback

If the script fails (auth issues, API changes), the agent can navigate the browser directly:

1. Open a browser and go to `https://polymorph.fyi`
2. Sign in with `POLYMORPH_TRAFFIC_EMAIL` / `POLYMORPH_TRAFFIC_PASSWORD`
3. For each session: click **New Chat**, type the query from the pool above, wait for the
   full response, then type the follow-up and wait again
4. Wait 15–30 seconds between sessions
5. Sign out when done

## Success output

The script prints a summary on exit:

```
=== All sessions complete ===
Generated 6 messages across 3 chats
These will be available for the traffic-monitor eval suite within 48 hours.
```

If any session fails, it logs the error and continues with the remaining sessions.
