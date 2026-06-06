---
description: Generate synthetic user sessions on polymorph.fyi using browser automation to produce eval pipeline baseline traffic. Run daily via /loop or on-demand. Each run completes 3 sessions covering research, chat, and build archetypes.
---

# Synthetic Traffic Generator

Drives a headless Chromium browser through polymorph.fyi to generate realistic chat sessions. The sessions land in the Supabase `messages` table where the evals traffic-monitor sampler picks them up.

## When to invoke

- On demand: `/synthetic-traffic`
- Daily loop: `/loop 24h /synthetic-traffic`
- After first-time setup to verify credentials work

## Prerequisites

Set `POLYMORPH_COOKIES` in `.env.local` with session cookies copied from a logged-in browser session on polymorph.fyi. The format matches the browser's `Cookie:` request header:

```
POLYMORPH_COOKIES=sb-access-token=eyJ...; sb-refresh-token=...; modelType=speed
```

To capture: open DevTools → Network → any `/api/chat` request → copy the `Cookie` header value.

Guest sessions work only if `ENABLE_GUEST_CHAT=true` is set in production, and guest chats may not appear in the eval sampler's output. Prefer authenticated sessions.

## Session archetypes

Each run uses one randomly-selected query per archetype. Rotate through different queries across runs to build a diverse eval dataset.

### 1 — Research (searchMode=research, multi-turn)

Triggers web search, citations, and the tool-selection / citation-accuracy evaluators.

Queries:

- "What are the most significant AI safety research developments in the past year?"
- "Explain the current state of nuclear fusion energy and the latest commercial milestones"
- "How have transformer architecture improvements evolved since the original attention paper?"
- "What does recent empirical research say about the effectiveness of remote work?"

Follow-up (sent after the first response): "What are the practical implications of this for the next 3–5 years?"

### 2 — Chat (searchMode=chat, single-turn)

Tests response quality and relevance without search.

Queries:

- "Explain the CAP theorem and the trade-offs it forces in distributed system design"
- "What's the difference between TCP and UDP, and when would a modern application use each?"
- "Why do some languages use garbage collection while others require manual memory management?"
- "Walk me through how public-key cryptography works, assuming I know basic math"

### 3 — Build / Creative (searchMode=chat, single-turn)

Tests code generation, tool-selection, and no-tool-placeholders evaluators.

Queries:

- "Write a TypeScript function that implements an LRU cache with O(1) get and put"
- "Write a Python script that reads a CSV and prints summary statistics for each numeric column"
- "Design a minimal REST API for a task management system: endpoints, request/response shapes, and status codes"
- "Write a regex to extract all URLs from a block of text and explain each part of the pattern"

## Execution

Run the script directly:

```bash
bun run synthetic-traffic
```

Or target production explicitly:

```bash
SYNTHETIC_TARGET=https://polymorph.fyi bun run synthetic-traffic
```

The script (`scripts/synthetic-traffic.ts`) launches headless Chromium, completes all 3 sessions sequentially with a 3-second pause between them, and prints a summary table.

If Playwright is not installed yet:

```bash
bun add -d playwright && bunx playwright install chromium
```

## After each run

Confirm sessions landed in Supabase:

```sql
SELECT id, created_at, metadata->>'userMode' AS mode
FROM messages
WHERE role = 'user'
ORDER BY created_at DESC
LIMIT 6;
```

The traffic-monitor eval suite samples the last N hours of messages; sessions show up in the next evals run automatically.

## Scheduling

For a persistent daily cadence, add a Railway cron service pointing at this script (mirrors how `polymorph-evals` is configured). For ad-hoc daily runs in an active Claude Code session, use `/loop 24h /synthetic-traffic`.
