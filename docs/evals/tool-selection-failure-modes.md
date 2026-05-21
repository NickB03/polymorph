# Tool-Selection Failure Modes

Source taxonomy for the `tool_selection` LLM-judge evaluator. Complements the existing deterministic `tool_usage` evaluator (which only scores presence/absence of search tools and citation alignment) by judging _whether the assistant chose the right tool_ for the user's intent.

## Method

Two data sources sampled on 2026-05-20:

1. **Phoenix experiments**. Capability (24 cases) and regression (3 cases) datasets are golden test sets engineered to succeed, so tool-selection failures there are rare by construction. The most recent traffic-monitor experiment landed 2026-05-10; production has had zero `POST /api/chat` requests for ≥10 days (per Vercel logs review on 2026-05-20), so no fresh real-world tool calls are available.

2. **Tool roster** enumeration. The chat agent has 25 registered tools across 6 families (catalog below). Failure modes are derived from the shape of the roster — i.e., the kinds of mis-selections the tool taxonomy makes possible — rather than from a large pool of observed failures, which doesn't exist yet.

This is the right starting point per the phoenix-evals principle "custom > generic": the rubric is grounded in this codebase's specific tool roster, not a generic "good tool use" template. The validation fixtures in Task 2 will mix real cases from the capability/regression corpus with synthetic adversarial cases that exercise each failure mode.

## Chat agent tool roster (as of 2026-05-20)

| Family                       | Tools                                                                                                                                                                                                               | Typical use                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Search/research              | `search`, `fetch`, `competitorResearch`                                                                                                                                                                             | Factual lookup, URL retrieval, multi-source competitive analysis    |
| Geo                          | `geocodeAddress`, `getDirections`, `getIsochrone`, `getStaticMapImage`                                                                                                                                              | Address resolution, routing, drive-time polygons, map images        |
| Canvas (replay-incompatible) | `createCanvasArtifact`, `updateCanvasArtifact`, `readCanvasArtifact`                                                                                                                                                | Building/modifying interactive HTML artifacts in the canvas surface |
| Image (replay-incompatible)  | `generateImage`                                                                                                                                                                                                     | DALL-E / FLUX image synthesis                                       |
| Display (Tool-UI)            | `displayPlan`, `displayTable`, `displayChart`, `displayGeoMap`, `displayCitations`, `displayLinkPreview`, `displayAgentArtifact`, `displayOptionList`, `displayQuestionWizard`, `displayCallout`, `displayTimeline` | Rendering structured UI components inline in the chat               |
| Todo                         | `setTodos`, `clearTodos` (per `createTodoTools`)                                                                                                                                                                    | Multi-step task tracking                                            |

Source: `lib/agents/chat/toolset.ts` and `lib/tools/tool-ui/server-catalog.ts`.

## Failure taxonomy

Four labels, designed to be binary-decidable by an LLM judge given (user query, available tools, tools called, model answer):

### 1. `correct_tool` (positive class, score 1.0)

The assistant called a tool appropriate for the query, OR correctly called no tools when the query needed none. Includes the "no tool needed and none called" case where a purely conversational reply is the right move.

**Examples:**

- Query "What's the weather in Tokyo?" → `search` called. ✅
- Query "Plot a route from SF to LA" → `geocodeAddress` + `getDirections` + `displayGeoMap`. ✅
- Query "Tell me a joke" → no tools, model answers from priors. ✅

### 2. `wrong_tool` (negative class, score 0.0)

The assistant called a tool whose purpose doesn't match the query. Common shapes derived from the roster:

- **Display tool for factual lookup**. Query asks for fresh information; model calls `displayFeatureList` or `displayPlan` without first calling `search`. The display tool can't fetch facts.
- **Search for canvas content**. Query asks to modify an existing canvas artifact; model calls `search` instead of `readCanvasArtifact` + `updateCanvasArtifact`.
- **Static map image for routing**. Query asks "how long to drive from A to B?"; model calls `getStaticMapImage` instead of `getDirections`. Static maps don't return travel time.
- **Geocode for non-geo entity**. Query asks to look up a person, brand, or concept; model calls `geocodeAddress`. The tool only resolves real addresses.

### 3. `missing_tool` (negative class, score 0.0)

The query required a tool (factual lookup needing fresh data, geo, current events, citations) but the model answered from its training-data priors without calling one. Existing `tool_usage` catches a narrow subset of this — only when `metadata.requiresCitations === true`. The new evaluator should catch missing tool calls more broadly:

- Query asks about news/events post-knowledge-cutoff; model answers without `search`. ❌
- Query asks for directions between two named cities; model answers with prose distance without calling `getDirections` or `geocodeAddress`. ❌

### 4. `not_required` (null, skipped)

The query is conversational, opinion-based, or about the assistant's own capabilities; no tool was needed and none was called. This is `tool_usage`'s `skipped` case and we preserve it: `score: null` excludes the case from aggregate calculations rather than treating it as a pass or fail.

## What this evaluator does NOT cover (deliberate scope cuts)

- **Tool argument quality** — Was the search query well-formed vs. a lazy "find X" echo? Worth a separate `tool_argument_quality` evaluator. Out of scope here.
- **Redundant calls** — Did the model call the same tool 5 times with similar args? Code-checkable; belongs in a deterministic evaluator, not this LLM judge.
- **Multi-step orchestration** — Did the model call tools in the right ORDER (e.g., `geocodeAddress` → `getDirections`, not the reverse)? Sequence judgment is harder for a single-shot judge; consider a separate `tool_sequence` evaluator that gets the full call sequence as input.
- **Canvas/image tool selection** — Sampler at `services/evals/src/sampler.ts:539-550` excludes chats with Canvas/image tool calls because they're not replayable. This evaluator inherits that exclusion. Solving it requires either (a) stubbing the side-effecting tools at replay time or (b) a Canvas-specific evaluator that judges the ORIGINAL chat's tool choice without replay. See Open Question 1 in the plan.

## Judging rubric (for the LLM judge prompt)

Given a user query, the list of available tools, the list of tools the model actually called, and the model's final answer text, decide which of the four labels applies. Judge **only** the tool selection — not the answer's correctness, not its tone, not its citations (other evaluators cover those). Reply with a single word.

When the call is ambiguous (e.g., a query could reasonably use either of two tools), prefer `correct_tool` — false negatives on this judge are more harmful than false positives, because they create noisy failure signals for the dashboard.
