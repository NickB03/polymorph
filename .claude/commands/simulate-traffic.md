# simulate-traffic

Simulate 3 realistic user sessions on polymorph.fyi using computer use to generate production eval traffic. Run this skill once per day, or on demand when the eval pipeline needs a baseline.

---

## What this skill does

You are acting as a curious user exploring polymorph.fyi. Your goal is to generate authentic, varied traffic that the eval pipeline can sample and judge. Each session covers a different mode so all three agent types (search, research, build) produce traces for the evaluators.

Do not narrate your intentions — just act. Take a screenshot before each meaningful action to confirm state.

---

## Environment setup

Open a browser at `https://polymorph.fyi`. If no browser is running, launch one:

```bash
chromium-browser --no-sandbox --disable-dev-shm-usage --window-size=1440,900 https://polymorph.fyi &
sleep 3
```

Then take a screenshot to confirm the page loaded.

If the page shows a login wall, the site requires authentication. In that case fall back to the API script instead:

```bash
bun scripts/simulate-traffic.ts --url https://polymorph.fyi/api/chat
```

---

## Session 1 — Research mode (deep multi-step)

**Target mode:** Research (the mode selector is in the composer row)

**Goal:** Submit a substantive research question that will trigger the full research agent: multi-step search, todo tracking, citations, and a long-form answer.

Pick ONE query from the pool below, or compose a similar one — vary the wording each day:

```
Analyze the competitive landscape of open-source AI inference engines in 2025
Compare federal EV charging infrastructure funding programs and their coverage gaps
What are the most promising approaches to long-duration grid energy storage right now?
Research recent breakthroughs in CRISPR-based therapeutics and their regulatory status
How are major cloud providers differentiating their AI platform offerings in 2025?
```

**Steps:**
1. Click the mode selector and choose **Research**
2. Click the chat input area
3. Type (don't paste) the selected query, varying capitalization or phrasing slightly
4. Submit and wait — research mode runs up to 50 steps; wait until the spinner stops and the answer section appears
5. Read one of the suggested follow-up questions at the bottom; click it if it looks interesting
6. Wait for that response too
7. Note the URL (e.g. `/search/clxxxx`)

---

## Session 2 — Chat/Search mode (quick lookup)

**Target mode:** Search (the default mode; verify it shows "Search" or "Chat" in the selector)

**Goal:** A practical quick question that exercises web search, a table or chart display tool, and a concise answer.

Pick ONE:

```
What are the top JavaScript bundlers in 2025 and how do they compare on build speed?
List the best open-source alternatives to Linear for project management
What's new in PostgreSQL 17 that matters for application developers?
Compare the pricing tiers of the major LLM API providers as of mid-2025
What are the current interest rates and how do they compare to the 2024 peak?
```

**Steps:**
1. Click the new-chat button (pencil icon or sidebar item) to start a fresh chat
2. Confirm mode is Search/Chat
3. Type the query
4. Submit; wait for the response (should complete in 10-30 seconds)
5. If the response includes a table or chart, hover over it briefly to show interactivity
6. Do not follow up — move to Session 3 after reading the answer

---

## Session 3 — Build mode (canvas artifact)

**Target mode:** Build

**Goal:** Request a simple interactive HTML artifact. This exercises the canvas artifact pipeline and `createCanvasArtifact` tool, giving the eval pipeline build-mode traces.

Pick ONE:

```
Build an interactive unit converter for length, weight, and temperature
Create a simple Pomodoro timer with start/pause/reset controls
Make a color palette generator — enter a hex code and show complementary and analogous colors
Build a BMI calculator with a visual result indicator
Create a simple flashcard app where I can add cards and flip through them
```

**Steps:**
1. Start a new chat
2. Click the mode selector → **Build**
3. Type the chosen query
4. Submit; the agent will think, then produce a Canvas artifact — wait for the iframe to appear
5. Click inside the artifact to interact with it briefly (this proves the canvas rendered)
6. Take a final screenshot showing the artifact

---

## Completion report

After all 3 sessions, output a summary:

```
## Traffic simulation complete

| # | Mode     | Query (truncated)                          | Chat URL          | Notes |
|---|----------|--------------------------------------------|-------------------|-------|
| 1 | Research | <first ~60 chars of your query>            | /search/clXXXX    |       |
| 2 | Search   | <first ~60 chars of your query>            | /search/clXXXX    |       |
| 3 | Build    | <first ~60 chars of your query>            | /search/clXXXX    |       |

Ran: <ISO timestamp>
```

If any session failed, note what went wrong and whether you fell back to the API script.

---

## Fallback: API-only mode

If computer use is unavailable or the site requires auth you can't satisfy visually, run the programmatic script directly:

```bash
POLYMORPH_COOKIES="<your-cookie-string>" bun scripts/simulate-traffic.ts --url https://polymorph.fyi/api/chat
```

See `scripts/simulate-traffic.ts --help` for options. The script picks different queries on each run from the same pools above, covering all three modes.

---

## Scheduling

To run this daily during an active Claude Code session:

```
/loop 24h /simulate-traffic
```

For unattended daily automation, use the Railway cron approach documented in `scripts/simulate-traffic.ts`.
