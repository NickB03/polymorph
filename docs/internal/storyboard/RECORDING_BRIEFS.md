# Recording briefs — two missing-footage scenes

You need to capture two short screen recordings to complete the reel. Drop both
into `/Users/nick/Projects/vana-v2/demo-video/reel/assets/`.

## Shared setup

- **Tool:** macOS Screen Recording (`Cmd+Shift+5` → "Record Selected Portion").
- **Window size:** match the existing recordings — logical ~1308 × 765 (Retina
  captures at 2616 × 1530, ratio ~1.71:1). Resize the browser/app window
  carefully before starting the selection drag.
- **Theme:** dark mode (the reel is dark-cinematic; light mode would clash with
  the title and end cards).
- **Cursor:** purposeful and minimal. Hover with intent on what matters; don't
  wave the cursor over irrelevant UI.
- **Length target:** 8–10 s raw. I'll trim into the best 6–7 s segment.

## Scene 3 — `genui-questions.mov`

**What we want viewers to see:** the chat agent producing a multiple-choice
question component (interactive chips), and the user clicking through to
continue the conversation.

**App state to set up before recording:**

- App running locally (`bun dev` → http://localhost:43100).
- Open a fresh chat.
- Run the project's chat once with the prompt below to confirm an interactive
  question component renders. If it doesn't, ping me — we'll grep
  `components/tool-ui/` and `lib/agents/chat/` to find a prompt that reliably
  triggers `displayOptionList` or `displayQuestionWizard`.

**Suggested trigger prompt (adjust as needed):**

> "Help me decide whether to build a weather dashboard, a workout tracker, or a recipe app — give me a quick question to pick."

Or any planning-style request that should prompt the agent to ask back with
options rather than answer directly.

**Shot sequence (8 s raw):**

| Seconds | What's on screen                                                             |
| ------- | ---------------------------------------------------------------------------- |
| 0–2     | Composer with the typed prompt visible; press Enter; agent begins responding |
| 2–4     | Interactive question component animates in (chips, option list, or wizard)   |
| 4–6     | Cursor hovers one of the chips deliberately, then clicks                     |
| 6–8     | Brief glimpse of the next agent turn responding to the selection             |

**Skip:** loading-only frames, "agent is typing" with no UI, scroll noise.

## Scene 4 — `evals-dashboard.mov`

**What we want viewers to see:** the `/admin/evals` dashboard with real
populated data, showing the breadth of evaluators and the run-level detail.

**App state to set up before recording:**

- App running locally; navigate to `http://localhost:43100/admin/evals`.
- Ensure recent eval runs are populated (the dashboard pulls from
  `eval_summaries` and `eval_case_results` per `docs/architecture/EVALS.md`).
  If your local DB has no data, point the dev app at the env where eval data
  is current.
- Pick the tab that looks most populated (Test Suite, Production Evals, or
  Regression Tests).

**Shot sequence (8 s raw):**

| Seconds | What's on screen                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0–2     | Default tab loaded; cursor at rest; KPI tiles and recent-runs table visible                                                      |
| 2–4     | Smooth hover-glide across the eight evaluator names (faithfulness, relevance, response-quality, safety, citation-accuracy, etc.) |
| 4–6     | Click another tab to show breadth (e.g., Test Suite → Production Evals); content updates                                         |
| 6–8     | Hover or click into a specific run row to show detail / drill-down                                                               |

**Pitfalls to avoid:**

- Empty states ("No runs yet") — kill the recording and seed data first.
- Visible browser debug overlays (React DevTools, Phoenix outline mode, etc.).
- Cursor parked on UI that's not under discussion (parking it center-screen is fine; parking it on a sidebar item is distracting).

## After you record

1. Drop both `.mov` files into `/Users/nick/Projects/vana-v2/demo-video/reel/assets/`.
2. Ping the agent — I'll:
   - Swap the two `<div class="placeholder">` blocks for `<video>` elements in
     `demo-video/reel/index.html`
   - Re-render via `npm run render`
   - Re-encode + regenerate poster via ffmpeg
   - Open the final MP4 for your visual review
3. Once you approve, you upload the final to GitHub user-attachments and
   send the URL — I update `README.md`.
