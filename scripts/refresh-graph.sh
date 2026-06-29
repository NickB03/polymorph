#!/usr/bin/env bash
# Refresh the graphify knowledge graph (graphify-out/graph.json) so the CI
# "Graph Freshness" guard passes after code changes. AST-only — no LLM, no
# network, no token cost.
#
# Skips gracefully (exit 0) when graphify isn't installed, so it never blocks a
# commit/push for contributors without the Python tooling — CI remains the
# backstop. Install graphify with: uv tool install graphifyy
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

resolve_python() {
  local p
  # 1. Interpreter pinned by the graphify skill (this checkout).
  if [ -f graphify-out/.graphify_python ]; then
    p="$(cat graphify-out/.graphify_python)"
    if [ -x "$p" ] && "$p" -c "import graphify" 2>/dev/null; then echo "$p"; return 0; fi
  fi
  # 2. A python3 that can import graphify.
  if command -v python3 >/dev/null 2>&1 && python3 -c "import graphify" 2>/dev/null; then
    echo "python3"; return 0
  fi
  # 3. uv-managed install.
  if command -v uv >/dev/null 2>&1; then
    p="$(uv tool run --from graphifyy python -c 'import sys, graphify; print(sys.executable)' 2>/dev/null || true)"
    if [ -n "$p" ]; then echo "$p"; return 0; fi
  fi
  return 1
}

if ! PYTHON="$(resolve_python)"; then
  echo "[refresh-graph] graphify not installed — skipping graph refresh (CI will verify)."
  exit 0
fi

"$PYTHON" scripts/refresh-graph.py
