# Synthetic Traffic Skill

**Trigger:** `/synthetic-traffic`

## Purpose

Generate 3 realistic user sessions on polymorph.fyi each day to populate production eval data for
the `traffic-monitor` evaluation suite. Without real traffic, that suite has nothing to sample.

**Automated path:** `.github/workflows/synthetic-traffic.yml` runs `scripts/synthetic-traffic.ts`
(Playwright, headless) daily at noon UTC — no Claude involvement.

**Interactive path (this skill):** When you invoke `/synthetic-traffic` manually, use computer use
to navigate the browser directly. Use this to verify sessions work, test a new archetype, or
regenerate traffic on demand.

---

## Prerequisites

1. Computer use tools available (screenshot, click, type).
2. Chromium or another browser open or launchable.
3. For authenticated sessions: `POLYMORPH_TEST_EMAIL` / `POLYMORPH_TEST_PASSWORD` set, or a
   browser session that is already signed in.

---

## Step 1 — Take a baseline screenshot

Confirm the browser state before starting. Note the current URL and whether you are signed in.

---

## Step 2 — Pick today's sessions

Select one session from each of the three pools below using the day index as the rotation key:

```
day_index = floor(unix_epoch_seconds / 86400)
research  = RESEARCH_POOL[ day_index % 3 ]
creative  = CREATIVE_POOL[ day_index % 3 ]
technical = TECHNICAL_POOL[ day_index % 3 ]
```

Announce which three sessions you selected before running them.

---

## Session Pools

### RESEARCH_POOL

**R0 — ai-frontiers**

1. "What are the most significant AI research breakthroughs from the past six months?"
2. "Which of these do you think will have the most real-world impact in 2–3 years?"
3. "What barriers do researchers say are still blocking deployment?"

**R1 — climate-tech**

1. "What are the most promising emerging technologies for carbon capture right now?"
2. "How does direct air capture compare to ocean-based carbon removal in cost and scalability?"
3. "Which companies or research groups are furthest ahead in this space?"

**R2 — biotech-crispr**

1. "Summarize the current state of CRISPR gene editing for treating genetic diseases."
2. "What are the main regulatory and ethical concerns slowing adoption?"
3. "Which clinical trials are furthest along, and what diseases do they target?"

---

### CREATIVE_POOL

**C0 — open-source-essay**

1. "Write a 400-word essay on why open-source AI development matters for society."
2. "Rewrite it for a technical audience — add specifics about licensing and model weights."
3. "Give it a stronger conclusion that calls researchers to action."

**C1 — future-city-story**

1. "Write a short 300-word story set in a city where all urban planning is decided by AI."
2. "Add a human protagonist who discovers and questions a decision the AI made."
3. "Resolve it in a way that shows both the strengths and limits of AI governance."

**C2 — product-pitch**

1. "Write a 3-paragraph product pitch for an app that helps households reduce food waste."
2. "Make it more emotional and personal — speak directly to the reader's daily experience."
3. "Add a one-sentence tagline that would work on a billboard."

---

### TECHNICAL_POOL

**T0 — rag-vs-finetuning**

1. "Explain the difference between RAG and fine-tuning for customizing large language models."
2. "In what scenarios would you choose one over the other?"
3. "What are the main engineering challenges in building a production RAG system?"

**T1 — transformer-attention**

1. "Explain how the attention mechanism in transformers works, step by step."
2. "How does multi-head attention improve on single-head attention?"
3. "What are the computational bottlenecks and how do modern architectures address them?"

**T2 — distributed-consistency**

1. "What are the CAP theorem trade-offs in distributed databases?"
2. "How do databases like CockroachDB or Spanner navigate those trade-offs in practice?"
3. "What should a developer know when deciding between strong and eventual consistency?"

---

## Step 3 — Run each session

Repeat this sequence for research → creative → technical:

### 3a. Open a fresh context

Open a new incognito/private window. This ensures each session has no cookies or storage from
prior sessions, matching how a new user would arrive.

### 3b. Navigate to the site

Go to `https://polymorph.fyi`. Wait for the page to finish loading. Take a screenshot to confirm
the UI is visible.

### 3c. Handle auth if needed

If a sign-in gate appears and you have test credentials:

- Click "Sign in"
- Enter the email and password
- Submit and wait for the redirect back to the chat interface

If credentials are unavailable and the gate appears, skip this session and note it in the report.

### 3d. Locate the chat input

Look for a textarea near the bottom of the page. Try these in order:

1. `textarea`
2. `[contenteditable="true"]`
3. `[data-testid="chat-input"]`
4. Any element with a placeholder mentioning "message" or "ask"

If none is found after scrolling the page, take a screenshot and skip this session.

### 3e. Send each message

For each of the 3 messages in the session:

1. Click the input to focus it.
2. Type the message (natural speed — do not paste all at once).
3. Press Enter or click the send button.
4. **Wait for the response to complete.** The response is done when:
   - A stop/cancel button disappears, OR
   - The loading spinner stops, OR
   - The chat input becomes editable again, OR
   - No visible text change has occurred for 3+ seconds
   - Absolute maximum wait: 90 seconds
5. Pause 10–20 seconds to simulate reading before the next message.

### 3f. Close the context

Close the incognito window. Move on to the next session type.

---

## Step 4 — Report

After all three sessions, output:

```
Synthetic Traffic Run — <date>

Sessions:
  ✓ research:  <name> — 3 messages sent
  ✓ creative:  <name> — 3 messages sent
  ✓ technical: <name> — 3 messages sent

Duration: ~Xm Ys
Notes: <anything unusual — auth wall, slow response, selector issues, etc.>
```

Mark any failed session `✗` with the error. Partial runs still generate eval data — do not abort
the remaining sessions because one failed.

---

## Automated mode reference

The `.github/workflows/synthetic-traffic.yml` cron runs the same pools via Playwright:

```
bun run scripts/synthetic-traffic.ts
```

Environment variables the script reads:

- `POLYMORPH_URL` — defaults to `https://polymorph.fyi`
- `POLYMORPH_TEST_EMAIL` / `POLYMORPH_TEST_PASSWORD` — optional; enables authenticated sessions

To run locally:

```bash
POLYMORPH_TEST_EMAIL=you@example.com POLYMORPH_TEST_PASSWORD=secret \
  bun run synthetic-traffic
```
