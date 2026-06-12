#!/usr/bin/env bash
#
# SessionStart hook for Claude Code on the web.
#
# Installs ffmpeg so the README hero demo can be regenerated in a web session
# via scripts/build-demo.sh. ffmpeg is optional tooling — this hook never blocks
# session startup if the install fails.
#
set -uo pipefail

# Register the graphify graph.json merge driver in this checkout's .git/config.
# .gitattributes (merge=graphify) travels with the repo, but the driver
# definition is per-environment. `bun install`/`prepare` covers normal checkouts;
# this covers fresh worktrees and cloud sessions where install may not have run,
# so a graph.json merge never falls back to raw conflict markers. Runs in every
# session (local + remote); the script no-ops outside a git work tree.
_proj="${CLAUDE_PROJECT_DIR:-$PWD}"
if [ -f "$_proj/scripts/setup-git-merge-drivers.sh" ]; then
  ( cd "$_proj" && bash scripts/setup-git-merge-drivers.sh ) || true
fi

# Only run in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Idempotent: container state is cached after the first run, so once ffmpeg is
# present there is nothing to do.
if command -v ffmpeg >/dev/null 2>&1; then
  exit 0
fi

echo "[session-start] Installing ffmpeg for demo regeneration (scripts/build-demo.sh)..."

# Some base images ship broken third-party PPAs (deadsnakes/ondrej) that 403 on
# apt update. Move them aside so the core Ubuntu repos still refresh.
sudo mkdir -p /etc/apt/disabled.d 2>/dev/null || true
for f in /etc/apt/sources.list.d/*deadsnakes* /etc/apt/sources.list.d/*ondrej*; do
  [ -e "$f" ] || continue
  sudo mv "$f" /etc/apt/disabled.d/ 2>/dev/null || true
done

LOG=/tmp/session-start-apt.log
if sudo apt-get update -y >"$LOG" 2>&1 \
  && sudo apt-get install -y --no-install-recommends ffmpeg >>"$LOG" 2>&1; then
  echo "[session-start] ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}') installed."
else
  echo "[session-start] WARNING: ffmpeg install failed; demo rebuild unavailable. See $LOG" >&2
fi

# Optional tooling — never block session startup on this.
exit 0
