# Graphify Long-Doc Gap Closure Plan

## Summary

Close the remaining Graphify quality gaps from the first successful local ingest after PR 249. The setup is complete and merged, but several long stable docs were only partially salvaged by the OpenRouter Pro fallback because the model hit structured-output limits. This follow-up should make the docs corpus extraction-friendly, rerun a clean local graph ingest, and keep generated graph output local-only.

No app runtime code, DB schema, or production behavior changes are required.

## Key Changes

- Split only the docs that either triggered partial salvage in the PR 249 ingest or are obviously too dense for reliable semantic extraction. Preserve existing top-level docs as navigation hubs when splitting.
- Known partial-salvage candidates from the PR 249 ingest:
  - `docs/architecture/GEO-TOOLS.md`
  - `docs/architecture/MODEL-CONFIGURATION.md`
  - `docs/architecture/RESEARCH-AGENT.md`
  - `docs/architecture/SEARCH-PROVIDERS.md`
  - `docs/architecture/STREAMING.md`
  - `docs/evals/tool-selection-failure-modes.md`
  - `docs/getting-started/CONFIGURATION.md`
  - `docs/getting-started/ENVIRONMENT.md`
  - `docs/getting-started/QUICKSTART.md`
  - `docs/operations/DEPLOYMENT.md`
  - `docs/operations/DOCKER.md`
  - `docs/operations/TROUBLESHOOTING.md`
  - `docs/reference/API.md`
  - `scripts/README.md`
- For each candidate, first measure section size with `wc -w` and `rg '^#{1,3} '`. Split only where there is a natural stable boundary, such as provider families, route groups, deployment phases, or troubleshooting categories.
- Keep each resulting doc slice small enough for reliable semantic extraction: target under 1200 words per leaf doc, with a clear title and one responsibility.
- Update any moved-section links in docs and `AGENTS.md` deeper-reference rows if their canonical target changes.
- Do not commit `graphify-out/`, ingest logs, or local scratch corpora.

## Implementation Procedure

1. Create a docs-only branch from updated `main`.
2. Audit the candidate docs and write a short split map before editing:
   ```bash
   for f in \
     docs/architecture/GEO-TOOLS.md \
     docs/architecture/MODEL-CONFIGURATION.md \
     docs/architecture/RESEARCH-AGENT.md \
     docs/architecture/SEARCH-PROVIDERS.md \
     docs/architecture/STREAMING.md \
     docs/evals/tool-selection-failure-modes.md \
     docs/getting-started/CONFIGURATION.md \
     docs/getting-started/ENVIRONMENT.md \
     docs/getting-started/QUICKSTART.md \
     docs/operations/DEPLOYMENT.md \
     docs/operations/DOCKER.md \
     docs/operations/TROUBLESHOOTING.md \
     docs/reference/API.md \
     scripts/README.md; do
       printf '\n== %s ==\n' "$f"
       wc -w "$f"
       rg -n '^#{1,3} ' "$f"
   done
   ```
3. Split source docs only where the split improves human navigation too. Leave a compact hub page at the original path with links to the new leaf docs.
4. Keep `.graphifyignore` unchanged unless the audit finds another noisy non-current-app path; do not exclude the stable docs just to hide the problem.
5. Run a clean local ingest and capture logs without committing them:
   ```bash
   rm -rf graphify-out /tmp/polymorph-graphify-long-doc.log
   set -a; source .env.local; set +a
   graphify . --no-viz \
     --backend openrouter \
     --model deepseek/deepseek-v4-pro \
     --max-concurrency 1 \
     --token-budget 8000 \
     2>&1 | tee /tmp/polymorph-graphify-long-doc.log
   graphify cluster-only .
   ```
6. If the Pro run still reports `truncated at max_completion_tokens` for a split doc, split that doc once more along the smallest useful section boundary and rerun the ingest. Do not try additional model/provider retries before fixing the doc shape.
7. Record final local graph stats in the implementation PR body, not in committed generated output.

## Test Plan

- Confirm the docs still format and pass repo gates:
  ```bash
  bun format:check
  bun lint
  bun typecheck
  git diff --check
  ```
- Confirm the clean ingest no longer reports partial salvage:
  ```bash
  ! rg 'truncated at max_completion_tokens|partial result kept|LLM returned invalid JSON' /tmp/polymorph-graphify-long-doc.log
  ```
- Confirm graph outputs exist locally and remain ignored:
  ```bash
  test -f graphify-out/graph.json
  test -f graphify-out/GRAPH_REPORT.md
  git status --short --ignored graphify-out
  ```
- Smoke-test doc-heavy graph answers:
  ```bash
  graphify query "how does streaming persist chat results?"
  graphify query "how are search providers selected and configured?"
  graphify query "what deployment steps are required for production?"
  ```

## Assumptions

- The goal is graph quality and docs maintainability, not shipping generated graph artifacts.
- Source-doc splitting is preferred over adding Graphify-only synthetic summaries because it helps both humans and the graph.
- `OPENROUTER_API_KEY` remains available in `.env.local`, and the OpenRouter provider remains registered globally.
- If a doc is already concise after audit, leave it unchanged even if it appeared in the first partial-salvage run.
