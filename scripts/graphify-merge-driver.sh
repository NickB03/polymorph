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

if command -v graphify >/dev/null 2>&1; then
  if graphify merge-driver "$O" "$A" "$B" >/dev/null 2>&1; then
    exit 0
  fi
fi

# Fallback: graphify is unavailable or the union merge failed. graph.json is
# fully regenerable, so keep the current branch's version (%A already holds it)
# and let the merge proceed rather than blocking on a conflict. Refresh with
# `graphify update .` afterward.
echo "graphify merge-driver unavailable; kept current graph.json (run 'graphify update .' to refresh)" >&2
exit 0
