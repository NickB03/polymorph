# Repo Cleanup Archive - 2026-06-09

Files in this folder were moved out of the active repo tree for review, not deleted.
Original paths are preserved under `.archive/repo-cleanup-2026-06-09/`.

## Why These Files Moved

- Historical implementation plans, specs, and static prototypes were archived because they are not durable project docs and several explicitly describe completed, superseded, or not-implemented work.
- Dead standalone source files were archived after import-specifier checks and subagent review found no live app/runtime imports.
- Unreferenced docs assets were archived when current README/app metadata uses other active assets.

## Review Inputs

- Docs/plans subagent: recommended archiving completed historical docs, static prototypes, and unreferenced docs assets while keeping AI-agent instructions and current operational docs.
- Source/assets subagent: confirmed high-confidence dead source files and warned against archiving App Router files, Tool UI compatibility shims, public demo assets, and low-confidence public logo assets.
- Scripts/config/evals subagent: confirmed `services/evals/**`, migrations, lockfiles, CI, generated canvas vendor chunks, and AI/design artifacts should stay active.
- Peer reviewer: found no live runtime import requiring removal from the archive set, added `docs/assets/architecture-mermaid.md`, and flagged stale docs/test references that were updated before the move.

## Intentionally Kept Active

- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `DESIGN.md`, `.claude/**`
- `polymorph.pen`, `claude-code-expert.skill`, `claude-code-expert-review.html`
- `services/evals/**`, migrations and Drizzle meta, lockfiles, CI/workflows
- App Router convention files, app icons, `public/demos/polymorph-demo.mp4`
- README demo/media assets that are still referenced
- Tool UI barrels and tool compatibility shims
- Public legacy logo PNGs and unused shadcn primitives, because they have possible external or design-system value

