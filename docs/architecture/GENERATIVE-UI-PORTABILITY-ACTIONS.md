# Generative UI Portability and Actions

> **Audience:** Architect | Contributor
> **Prerequisites:** [Generative UI](GENERATIVE-UI.md)

This leaf captures the community-portability proof, shared base fields, and action system.

### Community-portability evidence

Workstream 5 uses `competitorResearch` as the representative external/community-inspired AI SDK pattern: a structured Vercel AI SDK `tool({ inputSchema, execute })` definition ported through local adapters. The proof lives in [`lib/agents/chat/__tests__/community-portability.test.ts`](../../lib/agents/chat/__tests__/community-portability.test.ts) and exercises the local path rather than only checking registration:

- Research agent resolution and `activeTools` activation include `competitorResearch`, while search/chat and build definitions do not.
- `createChatAgentTools()` creates the specialist through the local toolset and executes it with mocked search/fetch tools shaped like real tool outputs.
- `components/tool-ui/registry.tsx` renders the structured result through the dedicated `CompetitorResearchResult` adapter.
- `lib/utils/message-mapping.ts` persists and restores the rich `tool-competitorResearch` part through dynamic tool columns.

This is an adapter-chain proof, not isolated git-history proof. It shows the current architecture can carry one structured AI SDK tool pattern through agent, toolset, rendering, and mapping seams without adding route/streaming/persistence-specific code for that tool. Verifying that a future change avoided route, streaming, or persistence edits still requires checking that change's diff.

### Shared base fields

All display tool schemas support optional base fields defined in `components/tool-ui/shared/schema.ts`:

| Field     | Type     | Description                                                                                                                         |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | `string` | Unique identifier for the component instance (`ToolUIIdSchema`)                                                                     |
| `role`    | `enum`   | Semantic role: `information`, `decision`, `control`, `state`, `composite` (`ToolUIRoleSchema`)                                      |
| `receipt` | `object` | Outcome tracking with `outcome` (success/partial/failed/cancelled), `summary`, `identifiers[]`, `timestamp` (`ToolUIReceiptSchema`) |

These base fields enable consistent identification, semantic classification, and outcome tracking across all generative UI components.

### Action system

Some display tools support an optional `actions[]` field for interactive buttons:

| Property       | Type      | Description                                                       |
| -------------- | --------- | ----------------------------------------------------------------- |
| `id`           | `string`  | Unique action identifier                                          |
| `label`        | `string`  | Button display text                                               |
| `variant`      | `enum`    | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` |
| `icon`         | `string`  | Optional Lucide icon name                                         |
| `disabled`     | `boolean` | Whether the action is disabled                                    |
| `shortcut`     | `string`  | Keyboard shortcut hint                                            |
| `confirmLabel` | `string`  | Confirmation text before executing                                |
| `sentence`     | `string`  | Natural language description sent back to the AI                  |

Currently supported on `OptionList` and extensible to other components via the shared `ActionSchema`.

---
