#!/usr/bin/env bash
#
# Register the graphify graph.json merge driver in this checkout's local git
# config. Run from the package.json `prepare` step so every `bun install`
# (local, worktree, cloud) self-registers the driver.
#
# Why this is needed: .gitattributes (`graph.json merge=graphify`) travels with
# the repo, but the driver *definition* lives in .git/config, which does not.
# Without this registration git would not know what `merge=graphify` means.
#
# Safe to run anywhere: it no-ops outside a git work tree and never fails the
# install.
set -uo pipefail

# Only meaningful inside a git work tree (skip Docker/CI tarball installs, etc.).
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

git config merge.graphify.name "graphify graph.json union merge" 2>/dev/null || exit 0
git config merge.graphify.driver \
  "bash scripts/graphify-merge-driver.sh %O %A %B" 2>/dev/null || exit 0

exit 0
