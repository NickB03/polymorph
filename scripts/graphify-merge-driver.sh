#!/usr/bin/env bash
#
# Git merge driver for graphify-out/graph.json.
#
# graph.json is a generated artifact committed to the repo (so the knowledge
# graph travels to every clone, worktree, and cloud session). Generated files
# conflict constantly on parallel branches, so this driver union-merges the two
# versions via the graphify CLI instead of producing a conflict.
#
# Registered per-environment by scripts/setup-git-merge-drivers.sh (run from the
# package.json `prepare` step) and activated by the `merge=graphify` attribute
# in .gitattributes.
#
# Git invokes it as: graphify-merge-driver.sh %O %A %B
#   %O = common ancestor version   (read-only)
#   %A = current/ours version      (MUST be overwritten with the merged result)
#   %B = other/theirs version      (read-only)
# Exit 0 => merge succeeded (git keeps %A). Non-zero => conflict.
set -uo pipefail

O="${1:?ancestor path}"
A="${2:?current path}"
B="${3:?other path}"

FIX="then run 'python scripts/check-graph-freshness.py --fix' and commit"

if ! command -v graphify >/dev/null 2>&1; then
  # Keeping one side silently would drop the other branch's LLM-extracted nodes
  # (the freshness guard only sees AST nodes), so surface a conflict instead.
  echo "graphify not on PATH; cannot union-merge graph.json. Install it (pip install graphifyy), abort and re-run the merge, $FIX. Do not resolve by picking one side: that drops the other branch's doc/semantic nodes." >&2
  exit 1
fi

if graphify merge-driver "$O" "$A" "$B" >/dev/null; then
  # The union merge only adds nodes, so symbols the other side deleted come
  # back; the freshness guard will flag them.
  echo "graph.json union-merged; $FIX if the freshness check reports stale symbols." >&2
  exit 0
fi

echo "graphify merge-driver failed (see error above); resolve graph.json manually, $FIX." >&2
exit 1
