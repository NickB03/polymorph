---
name: drive-traffic
description: Simulate 3 realistic user sessions on polymorph.fyi to generate eval traffic. Run daily (via /loop) so the eval pipeline has chat records to sample from.
trigger: /drive-traffic
---

# /drive-traffic

Drives 3 synthetic but realistic user sessions against production polymorph.fyi. Each session uses a different search mode, model, and topic — chosen to exercise all 9 eval dimensions (faithfulness, relevance, response-quality, safety, citation-accuracy, tool-usage, tool-selection, no-tool-placeholders, prechecks).

Sessions:

| # | Name | Mode | Model | Turns | Eval focus |
|---|------|------|-------|-------|------------|
| 1 | Research – Science & Health | research | quality | 2 | faithfulness, citations, tool-selection |
| 2 | Explanation – Technical Concept | chat | quality | 1 | relevance, response-quality |
| 3 | Research – Technology Comparison | research | speed | 2 | tool-usage, faithfulness, relevance |

---

## Setup (one-time)

The script authenticates via a browser cookie string. Do this once after any sign-in or when cookies expire:

1. Sign in to polymorph.fyi in your browser
2. Open DevTools → Network tab → trigger any chat request
3. Click that request → Headers → copy the full **Cookie** header value
4. Add to `.env.local` in the repo root:

```
POLYMORPH_COOKIES="sb-...=...; ..."
```

Optional overrides (also in `.env.local`):

```
POLYMORPH_URL=https://polymorph.fyi   # change to hit staging instead
DRIVE_TRAFFIC_DELAY_MS=8000           # ms pause between sessions
```

---

## What Claude does when this skill is invoked

1. **Check env.** If `POLYMORPH_COOKIES` is missing from the environment, report it clearly and stop — do not guess or invent a cookie value.

2. **Run the script:**
   ```bash
   bun run scripts/drive-traffic.ts
   ```
   Capture stdout/stderr and show it to the user.

3. **Interpret the result.**
   - On success: confirm that eval records are queued and remind the user the eval pipeline runs every 48 h.
   - On auth failure (HTTP 401/403): tell the user their cookies have expired and re-run the setup steps above.
   - On other errors: surface the full error message so the user can diagnose.

4. **Do not modify session content** unless the user explicitly asks. The prompts are calibrated for the eval dimensions — changing them dilutes coverage.

---

## Scheduling (recommended: once per day)

Use the loop skill to keep it running on a schedule:

```
/loop 24h /drive-traffic
```

This keeps the Claude Code session alive and fires the skill every 24 hours. The first run happens immediately when you invoke it.

To stop: end the Claude Code session or reply "stop" when the loop fires.

---

## Adding or editing sessions

Sessions live in `scripts/drive-traffic.ts` in the `SESSIONS` array. Each entry has:

```typescript
{
  name: string           // displayed in logs
  searchMode: 'research' | 'chat'
  modelType: 'speed' | 'quality'
  turns: [{ message: string }, ...]
}
```

Keep prompts genuinely question-shaped (not obviously robotic) so the evals reflect realistic usage. Vary topics across sessions for broader coverage.
