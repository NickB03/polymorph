# simulate-traffic

Simulate realistic user sessions on Polymorph.fyi to seed the production eval pipeline with chat samples.

## Purpose

The eval cron (`services/evals/`) samples the last 48 hours of chat messages from Supabase and runs 9 evaluators against them. With low organic traffic, the `traffic-monitor` suite has nothing to sample. This skill runs 3 browser sessions — covering both `userMode` values the evaluators care about (`search` and `research`) — to ensure the pipeline always has data.

## When to invoke

- User says: "simulate traffic", "generate eval traffic", "seed the eval pipeline", "run traffic sessions"
- Daily, to keep the 48-hour sampling window populated

## Pre-flight

1. Take a screenshot of the current browser state.
2. If `https://polymorph.fyi` is not open, navigate there now.
3. Check the top-right corner for a signed-in avatar. If not signed in, click **Sign in** and authenticate before continuing. The sessions must be authenticated so messages land in the DB under a real user ID.
4. Confirm the page loaded (chat input visible). If it didn't load in 10 seconds, reload once.

---

## Session 1 — Research deep-dive (`userMode: research`, `searchMode: research`)

**Persona:** a curious person doing substantive background research.

### Setup
- Click **New chat** (or navigate to `/`).
- Locate the mode selector in the chat interface and set it to **Research** mode.

### Prompt bank — pick whichever you haven't used in the last run

| # | Opening query |
|---|---------------|
| A | "What are the most significant advances in nuclear fusion energy over the past two years, and which projects are closest to commercialization?" |
| B | "Walk me through the current state of quantum error correction and what the main technical barriers to fault-tolerant quantum computers are." |
| C | "What has changed in the large language model landscape since GPT-4's release — key capability jumps, new architectures, and competitive dynamics?" |
| D | "What are the leading approaches to carbon capture today, and how do their costs and scalability compare?" |

### Follow-up cadence (wait for full response before each)
1. Opening query above — wait for complete response including any source cards.
2. "What's the most significant development or breakthrough in the last six months?"
3. "What are the strongest criticisms or counterarguments to the mainstream view here?"
4. (Optional 4th turn if the conversation is going well) "If you had to bet on what changes most in the next two years, what would it be?"

---

## Session 2 — Quick search (`userMode: search`, `searchMode: chat`)

**Persona:** someone who wants a fast, direct, well-sourced answer.

### Setup
- Click **New chat**.
- Set mode to **Search** (not Research).

### Prompt bank

| # | Opening query |
|---|---------------|
| A | "What is the current federal funds rate and when did the Fed last adjust it?" |
| B | "What are the top five programming languages by developer adoption in 2025?" |
| C | "Which countries currently operate commercial high-speed rail and how do their networks compare by route length?" |
| D | "What is the current state of the EU AI Act — has it been fully implemented and what are the key compliance deadlines?" |

### Follow-up cadence
1. Opening query — wait for response.
2. One specific follow-up drilling into the most interesting detail from the answer (e.g., "Can you say more about [specific item]?").
3. One comparative question (e.g., "How does this compare to the situation in [relevant country/year/alternative]?").

---

## Session 3 — Exploratory multi-turn (`userMode: research`, `searchMode: research`)

**Persona:** someone exploring a nuanced topic with real depth, building on each answer.

### Setup
- Click **New chat**.
- Set mode to **Research**.

### Prompt bank

| # | Opening query |
|---|---------------|
| A | "I want to understand the tradeoffs between different database architectures — relational, document, columnar, vector — for a modern AI-heavy web application. Where should I start?" |
| B | "What are the key factors that determine whether an early-stage startup should build vs. buy for core infrastructure like auth, search, and observability?" |
| C | "Walk me through the main evidence-based schools of thought on longevity and what interventions have the strongest research behind them." |
| D | "What does the research say about the most effective approaches to learning a complex technical skill as an adult?" |

### Follow-up cadence
1. Opening query — wait for complete response.
2. Pick the sub-topic from the response that seems most important and ask for a deeper explanation.
3. "What's the strongest counterargument to what you just said?"
4. "Given everything above, what's your concrete recommendation for someone in my situation?" (adapt to the topic — just pick the practical takeaway angle).

---

## Execution rules

- **Never rush.** Wait for the assistant to fully finish each response (streaming complete, no spinner) before sending the next message.
- **One session at a time.** Complete Session 1 fully before starting Session 2.
- **Different topics per run.** Rotate through the prompt bank (A → B → C → D → A…) across daily runs to maximize topic diversity in the eval dataset.
- **Don't switch topics mid-session.** The conversation thread matters for context quality in the evaluators.

---

## Completion report

After all three sessions finish, output exactly this block (fill in the blanks):

```
=== Traffic Simulation Complete ===
Date:          [today's date]
Sessions run:  3
Modes covered: research (×2), search (×1)
Topics used:   [brief label for each session's topic]
Approx turns:  [total message count across all sessions]
Next run:      ~24 hours (stay within the 48-hour eval lookback window)
===================================
```

---

## Scheduling

To run this automatically without manual invocation each day:

**Option A — Loop while this session is active:**
```
/loop 24h /simulate-traffic
```

**Option B — Railway cron (recommended for unattended runs):**
Add a new Railway service pointing to `scripts/simulate-traffic.ts` (Playwright headless) with cron schedule `0 10 * * *`. This keeps the eval window populated regardless of whether a Claude Code session is open.

See `services/evals/` for the eval pipeline this feeds.
