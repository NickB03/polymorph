# generate-traffic

Simulate realistic user sessions on the production Polymorph site to generate eval traffic. Runs 3 sessions covering different modes so the eval pipeline has meaningful, varied traces to score.

## When to invoke

- Manually, to seed eval data before an audit
- Via `/loop 24h /generate-traffic` for daily synthetic traffic

## Execution

### Preferred: computer use (interactive sessions)

If computer use tools are available (you can take screenshots and click in a browser), run each session visually so the full client-side rendering pipeline is exercised:

1. Open the browser to `https://polymorph.fyi`
2. Wait for the chat input to appear
3. For each session below, in order:
   a. Set the mode using the mode selector (search / research / build)
   b. Click the chat input and type the prompt exactly
   c. Press Enter to submit
   d. Wait for the response to finish streaming (the stop button disappears)
   e. Take a screenshot to confirm the response rendered
   f. Wait 30 seconds before the next session (natural pacing)
4. Report a summary: session name, mode, first 100 chars of the response, any errors

### Fallback: headless script

If computer use is not available, run the script:

```bash
bun scripts/generate-traffic.ts
```

Set `POLYMORPH_COOKIES` in `.env.local` to your production session cookies if the site requires auth (copy from DevTools → Network → any chat request → Cookie header).

## Sessions

Run these in order. Each is a fresh chat (new session).

### Session 1 — Research

**Mode:** research  
**Model:** quality  
**Prompt:**

```
What are the most significant AI safety research developments from the past year, and what open problems remain? Cite your sources.
```

### Session 2 — Build

**Mode:** build  
**Model:** quality  
**Prompt:**

```
Create an interactive dashboard showing global renewable energy adoption trends over the last decade. Include a line chart, a summary table by region, and a brief analysis.
```

### Session 3 — Chat

**Mode:** chat  
**Model:** speed  
**Prompt:**

```
Explain the key differences between RAG and fine-tuning for LLM applications, and when you'd choose one over the other.
```

## Verification

After all sessions complete:

- Confirm 3 new traces appear in Phoenix under the production project
- Check that no session returned an error or empty response
- If any session failed, re-run it once before reporting the failure

## Notes

- Guest access works if `ENABLE_GUEST_CHAT=true` on production; otherwise cookies are required
- Rate limits may apply for guest sessions — use auth cookies to avoid them
- The 30-second pause between sessions mimics real user pacing and avoids triggering aggressive rate limits
