# Graphify Claude Codex Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Graphify once and register it for Claude Code and Codex, with Codex multi-agent extraction enabled for all local Codex sessions.

**Architecture:** Use `uv tool install graphifyy` for the isolated CLI install, then add both user-level skill registrations and project-level always-on integrations. Treat generated edits to `CLAUDE.md`, `AGENTS.md`, `.claude/`, and `.codex/` as reviewable repo changes, not as trusted boilerplate.

**Tech Stack:** Graphify `graphifyy` Python CLI, uv tools, Claude Code skills/hooks, Codex skills/hooks, Codex `~/.codex/config.toml`.

---

## Assumptions

- "code" means Codex. If the intended target is VS Code Copilot Chat or Cursor, do not run the Codex-specific steps until the target is clarified.
- `multi_agent = true` is a Codex setting. Current Graphify docs do not define an equivalent Claude Code `multi_agent` config key, so this plan enables it in `/Users/nick/.codex/config.toml` only.
- The install should support this repo at `/Users/nick/.codex/worktrees/9bad/vana-v2` and the user's local Claude Code/Codex sessions.

## Expected File Changes

- Modify user config: `/Users/nick/.codex/config.toml`
- Create or update user skill: `/Users/nick/.claude/skills/graphify/SKILL.md`
- Create or update user skill: `/Users/nick/.codex/skills/graphify/SKILL.md`
- Modify repo guidance: `CLAUDE.md`
- Modify repo guidance: `AGENTS.md`
- Create or update repo skill/hooks: `.claude/skills/graphify/SKILL.md`, `.claude/settings.json`
- Create or update repo skill/hooks: `.codex/skills/graphify/SKILL.md`, `.codex/hooks.json`

## Task 1: Baseline The Existing State

**Files:**

- Read: `/Users/nick/.codex/config.toml`
- Read: `CLAUDE.md`
- Read: `AGENTS.md`

- [ ] **Step 1: Confirm clean repo state**

Run:

```bash
git status --short
```

Expected: no output, or only changes the implementer already understands and will preserve.

- [ ] **Step 2: Confirm Graphify CLI availability without installing**

Run:

```bash
uvx --from graphifyy graphify --version
uvx --from graphifyy graphify install --help
```

Expected: `graphify` prints a version, and install help includes both `claude` and `codex` platforms.

- [ ] **Step 3: Snapshot the Codex feature block**

Run:

```bash
nl -ba /Users/nick/.codex/config.toml | sed -n '86,100p'
```

Expected: the `[features]` block is visible. If `multi_agent = true` is already present, Task 3 becomes a verification-only task.

## Task 2: Install Or Upgrade The Graphify CLI

**Files:**

- Modify through uv tool state only: uv-managed `graphifyy` tool environment

- [ ] **Step 1: Install or upgrade Graphify**

Run:

```bash
uv tool install graphifyy --force
```

Expected: uv installs or refreshes the `graphify` executable without using repo-local Python packages.

- [ ] **Step 2: Verify the installed CLI**

Run:

```bash
which graphify
graphify --version
graphify --help | sed -n '1,80p'
```

Expected: `graphify` resolves on `PATH`, prints a version, and lists `install`, `claude install`, and `codex install` commands.

## Task 3: Enable Codex Multi-Agent Globally

**Files:**

- Modify: `/Users/nick/.codex/config.toml`

- [ ] **Step 1: Add the Codex feature flag**

Edit `/Users/nick/.codex/config.toml` so the existing `[features]` block includes:

```toml
[features]
unified_exec = true
shell_snapshot = true
steer = true
memories = true
js_repl = false
multi_agent = true
```

Expected: preserve the existing feature keys and add exactly one `multi_agent = true` entry.

- [ ] **Step 2: Verify there is only one flag**

Run:

```bash
rg -n '^multi_agent\\s*=\\s*true$|^\\[features\\]' /Users/nick/.codex/config.toml
```

Expected: one `[features]` section and one `multi_agent = true` line.

## Task 4: Register User-Level Skills For Claude Code And Codex

**Files:**

- Create or update: `/Users/nick/.claude/skills/graphify/SKILL.md`
- Create or update: `/Users/nick/.codex/skills/graphify/SKILL.md`

- [ ] **Step 1: Install the Claude Code skill**

Run:

```bash
graphify install --platform claude
```

Expected: Graphify reports a Claude skill install under `/Users/nick/.claude/skills/graphify/`.

- [ ] **Step 2: Install the Codex skill**

Run:

```bash
graphify install --platform codex
```

Expected: Graphify reports a Codex skill install under `/Users/nick/.codex/skills/graphify/`.

- [ ] **Step 3: Verify both skill files**

Run:

```bash
test -f /Users/nick/.claude/skills/graphify/SKILL.md
test -f /Users/nick/.codex/skills/graphify/SKILL.md
sed -n '1,40p' /Users/nick/.claude/skills/graphify/SKILL.md
sed -n '1,40p' /Users/nick/.codex/skills/graphify/SKILL.md
```

Expected: both files exist and identify Graphify usage for the correct assistant.

## Task 5: Add Project-Level Always-On Support

**Files:**

- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Create or update: `.claude/skills/graphify/SKILL.md`
- Create or update: `.claude/settings.json`
- Create or update: `.codex/skills/graphify/SKILL.md`
- Create or update: `.codex/hooks.json`

- [ ] **Step 1: Install Claude Code project support**

Run from `/Users/nick/.codex/worktrees/9bad/vana-v2`:

```bash
graphify install --project --platform claude
```

Expected: Graphify creates or updates `.claude/skills/graphify/`, `.claude/settings.json`, and the root `CLAUDE.md` Graphify section.

- [ ] **Step 2: Install Codex project support**

Run from `/Users/nick/.codex/worktrees/9bad/vana-v2`:

```bash
graphify install --project --platform codex
```

Expected: Graphify creates or updates `.codex/skills/graphify/`, `.codex/hooks.json`, and the root `AGENTS.md` Graphify section.

- [ ] **Step 3: Review generated repo changes**

Run:

```bash
git diff -- CLAUDE.md AGENTS.md .claude .codex
```

Expected: the diff contains only Graphify sections, Graphify skill files, and Graphify hook configuration. If `CLAUDE.md` stops being a simple pointer to `AGENTS.md`, decide whether that is acceptable before committing.

- [ ] **Step 4: Verify generated hooks are scoped to Graphify**

Run:

```bash
rg -n 'graphify|PreToolUse|hook-check' .claude .codex CLAUDE.md AGENTS.md
```

Expected: hook entries invoke Graphify only; no unrelated command or broad shell automation is introduced.

## Task 6: Smoke Test Both Assistants

**Files:**

- Create or update at runtime: `graphify-out/`

- [ ] **Step 1: Build a small graph from Codex syntax**

Run from `/Users/nick/.codex/worktrees/9bad/vana-v2`:

```bash
graphify . --no-viz
```

Expected: `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` are created.

- [ ] **Step 2: Verify Codex invocation wording**

In Codex, run:

```text
$graphify query "what are the main chat rendering files?"
```

Expected: Codex recognizes `$graphify` and returns graph-backed file references.

- [ ] **Step 3: Verify Claude Code invocation wording**

In Claude Code, run:

```text
/graphify query "what are the main chat rendering files?"
```

Expected: Claude Code recognizes `/graphify` and returns graph-backed file references.

## Task 7: Final Review And Commit

**Files:**

- Stage intentionally: `.graphifyignore`, `.gitignore`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.codex/`, this plan file
- Do not stage: `graphify-out/` or `.env.local`

- [ ] **Step 1: Review all changed files**

Run:

```bash
git status --short
git diff --name-only
```

Expected: changed files match the expected Graphify install files and this plan.

- [ ] **Step 2: Confirm graph output stays local-only**

Run:

```bash
find graphify-out -maxdepth 2 -type f | sort
```

Expected: `graphify-out/` is ignored and remains local-only unless the user explicitly asks to version generated graph output.

- [ ] **Step 3: Stage explicit files**

Run:

```bash
git add -- \
  docs/superpowers/plans/2026-06-08-graphify-claude-codex-install.md \
  CLAUDE.md \
  AGENTS.md \
  .claude \
  .codex
```

Expected: only intended Graphify support files are staged.

- [ ] **Step 4: Commit**

Run:

```bash
git commit -m "chore: add graphify assistant support"
```

Expected: one narrow commit containing the plan and reviewed Graphify assistant support.

## Optional Branch: If "Code" Means VS Code Or Cursor

Do not mix this branch with the Codex install unless the user confirms the target.

- VS Code Copilot Chat:

```bash
graphify vscode install
```

- Cursor:

```bash
graphify cursor install
```

Review generated `.github/` or `.cursor/` files before staging.

## Acceptance Criteria

- `graphify --version` works from the shell.
- `/Users/nick/.codex/config.toml` has exactly one `multi_agent = true` under `[features]`.
- Claude Code has a Graphify skill at `/Users/nick/.claude/skills/graphify/SKILL.md`.
- Codex has a Graphify skill at `/Users/nick/.codex/skills/graphify/SKILL.md`.
- This repo has reviewed Graphify support under `.claude/`, `.codex/`, `CLAUDE.md`, and `AGENTS.md`.
- Codex uses `$graphify ...`; Claude Code uses `/graphify ...`.

## Follow-up: Clean Current-App Corpus

The first full ingest attempts showed that the default corpus was too broad for a cheap, reliable OpenRouter run: generated Graphify skill docs, historical `docs/superpowers/` plans, demo media, and bulky generated docs caused noisy chunks and invalid/truncated JSON from the model. Before completing the ingest, add a root `.graphifyignore` that keeps the corpus focused on current app source plus stable product, architecture, operations, and API docs.

Also exclude noisy root meta docs and automation surfaces from the corpus before retrying: `GEMINI.md`, `DESIGN.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/`, and the archived cleanup tree.

Use the repo's OpenRouter key explicitly instead of allowing Graphify to auto-select Gemini:

```bash
rm -rf graphify-out
set -a; source .env.local; set +a
graphify . --no-viz \
  --backend openrouter \
  --model deepseek/deepseek-v4-flash \
  --max-concurrency 2 \
  --token-budget 20000
```

If Flash returns invalid or truncated JSON, clear `graphify-out/` and retry once with the lower-concurrency Pro path:

```bash
rm -rf graphify-out
graphify . --no-viz \
  --backend openrouter \
  --model deepseek/deepseek-v4-pro \
  --max-concurrency 1 \
  --token-budget 8000
```

Keep `graphify-out/` local-only unless the user explicitly asks to version generated graph output.

## Completion Notes

- PR 248 was merged first so the archived cleanup tree could be excluded from the corpus.
- Final detection found 883 code files and 40 docs, with no archive, media, generated skill, or historical-plan violations.
- The Flash OpenRouter run hit invalid JSON and was stopped. The Pro fallback completed with partial salvage on several long docs and wrote `graphify-out/graph.json` with 6302 nodes, 18820 edges, and 190 communities after `cluster-only`.
- `graphify-out/GRAPH_REPORT.md` was generated locally. HTML visualization was skipped because the graph exceeds Graphify's 5000-node HTML limit.
