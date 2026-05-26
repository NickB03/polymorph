# Runtime Available Tools Round-Trip Plan

## Goal

Capture the chat agent's actual runtime tool roster for each eval replay and pass that exact list into Phoenix dataset examples, replacing the current static `KNOWN_AGENT_TOOLS` approximation.

## Evidence

- The v7 recovery fixed stale Phoenix examples and confirmed `availableTools` reaches fresh datasets.
- A1 drift re-check returned `8` commits touching `lib/agents/chat/toolset.ts`, `lib/tools/tool-ui/server-catalog.ts`, and `lib/tools/todo.ts` in the last six months, above the deferral threshold of `3`.
- The static roster still overstates availability for some cases, especially `competitorResearch` outside research-mode agents. That makes `tool_selection` false positives harder to interpret.

## Constraints

- Do not remove tools from the static fallback until runtime capture has test coverage.
- Preserve eval replay filters for non-replayable canvas, image, writer-only, and interactive Tool UI tools.
- Keep the Phoenix dataset input field as `availableTools` and the judge prompt vocabulary as `available_tools`.

## Tasks

1. Add a helper near chat-agent construction that resolves the active tool names after mode, context, and eval filters are applied.
2. Return the runtime tool list from `/api/evals/run` alongside `answerText`, `toolNames`, `searchResults`, and citations.
3. Update `services/evals/src/runners/shared.ts` so dataset examples use `result.availableTools` when present and fall back to `KNOWN_AGENT_TOOLS` only for legacy outputs.
4. Add unit tests for search, research, build, and eval-mode filtering, including absence of canvas/image/todo tools without their contexts.
5. Add an eval-runner route test proving `availableTools` round-trips from agent runtime to the JSON response.
6. Rerun `services/evals` tests/typecheck and root checks before opening the follow-up PR.

## Verification

- `cd services/evals && bun run test`
- `cd services/evals && bun run typecheck`
- `bun run test`
- `bun lint`
- `bun typecheck`
- `bun format:check`
