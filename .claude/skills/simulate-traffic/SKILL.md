---
name: simulate-traffic
description: 'Simulate 3 realistic user sessions on polymorph.fyi using Claude computer use. Generates Supabase chat records the traffic-monitor eval suite can sample. One research session, one multi-turn chat, one creative task — topics rotate by day of year.'
trigger: /simulate-traffic
---

# /simulate-traffic

Drives a real Chromium browser via Claude computer use to simulate 3 user sessions on polymorph.fyi. Each session produces genuine chat records in Supabase so the traffic-monitor eval runner has production traffic to audit.

## Sessions

| Session           | Interaction style                                        |
| ----------------- | -------------------------------------------------------- |
| `research`        | Single query on a rotating factual topic + one follow-up |
| `multi-turn-chat` | Conceptual question + one clarifying follow-up           |
| `creative`        | Creative task + one refinement request                   |

Topics rotate by day-of-year across a pool of ~14 research, 10 chat, and 8 creative prompts — no manual rotation needed.

## Prerequisites

These must be set in `.env.local` or the current shell:

```
ANTHROPIC_API_KEY=...
POLYMORPH_TEST_EMAIL=...      # test account email
POLYMORPH_TEST_PASSWORD=...   # test account password
```

For GitHub Actions the same three values are stored as repository secrets
(`ANTHROPIC_API_KEY`, `POLYMORPH_TEST_EMAIL`, `POLYMORPH_TEST_PASSWORD`).

Optional overrides:

```
POLYMORPH_URL=https://polymorph.fyi   # default
SIMULATION_HEADLESS=false              # show browser window locally
SIMULATION_MAX_STEPS=20                # computer-use steps per session
```

## Steps to invoke interactively

1. **Check prerequisites**

   ```bash
   [[ -n "$ANTHROPIC_API_KEY" && -n "$POLYMORPH_TEST_EMAIL" && -n "$POLYMORPH_TEST_PASSWORD" ]] \
     && echo "✓ env OK" || echo "✗ missing env vars"
   ```

2. **Install Playwright browser** (one-time, safe to re-run)

   ```bash
   bunx playwright install chromium --with-deps
   ```

3. **Run the simulation**

   ```bash
   bun run simulate-traffic
   ```

   Or directly:

   ```bash
   bun run scripts/simulate-traffic.ts
   ```

4. **Report results** — the script prints a per-session table at the end:

   ```
   ─────────────────────────────────────────────────────
   Traffic simulation: 3/3 sessions succeeded
     ✓ research: 11 steps, 87.3s
     ✓ multi-turn-chat: 9 steps, 72.1s
     ✓ creative: 8 steps, 65.8s
   ─────────────────────────────────────────────────────
   ```

5. **Verify traffic landed** — check the Supabase `messages` table or trigger a
   traffic-monitor eval run to confirm the sampler picks up the new chats.

## Automated daily run

`.github/workflows/traffic-simulation.yml` runs on a `cron: '0 3 * * *'` schedule
(03:00 UTC). It also exposes a `workflow_dispatch` trigger for on-demand runs.

The workflow exits 1 if all 3 sessions fail. A single partial failure (1–2
sessions fail) still exits 0 so the cron doesn't alert on transient flakiness —
check the logs for per-session detail.

## Troubleshooting

| Symptom                              | Likely cause                       | Fix                                                             |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------------- |
| `ANTHROPIC_API_KEY is required`      | Missing env var                    | Set the var                                                     |
| Session stuck at "reached max steps" | Slow page or auth loop             | Increase `SIMULATION_MAX_STEPS`; check test account credentials |
| All sessions fail immediately        | Playwright not installed           | Run `bunx playwright install chromium --with-deps`              |
| Site unreachable                     | `POLYMORPH_URL` wrong or site down | Verify URL; check site status                                   |
| Computer use errors on beta header   | SDK too old (need ≥0.36)           | `bun add -d @anthropic-ai/sdk@latest`                           |
