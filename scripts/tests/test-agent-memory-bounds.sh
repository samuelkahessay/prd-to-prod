#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
REPO_ASSIST="$ROOT_DIR/.github/workflows/repo-assist.md"
FRONTEND_AGENT="$ROOT_DIR/.github/workflows/frontend-agent.md"

check_bounded_memory_contract() {
  local workflow="$1"
  local state_file="$2"
  local legacy_prefix="$3"
  local label="$4"

  grep -F "$state_file" "$workflow" >/dev/null || {
    echo "FAIL: $label must store mutable state in $state_file" >&2
    exit 1
  }

  grep -F 'Do not create one file per issue, PR, stage, or run.' "$workflow" >/dev/null || {
    echo "FAIL: $label must forbid file-per-issue memory growth" >&2
    exit 1
  }

  grep -F '100-file validation limit' "$workflow" >/dev/null || {
    echo "FAIL: $label must acknowledge the repo-memory file-count budget" >&2
    exit 1
  }

  grep -F "basename starts with \`$legacy_prefix\`" "$workflow" >/dev/null || {
    echo "FAIL: $label must prune legacy $legacy_prefix checkpoint files" >&2
    exit 1
  }
}

check_bounded_memory_contract \
  "$REPO_ASSIST" \
  '/tmp/gh-aw/repo-memory/default/state/repo-assist.json' \
  'checkpoint:' \
  'repo-assist'

check_bounded_memory_contract \
  "$FRONTEND_AGENT" \
  '/tmp/gh-aw/repo-memory/default/state/frontend-agent.json' \
  'frontend-checkpoint:' \
  'frontend-agent'

if rg -F 'checkpoint:<issue-number>:plan' "$REPO_ASSIST" >/dev/null; then
  echo "FAIL: repo-assist must not instruct file-per-stage checkpoints" >&2
  exit 1
fi

if rg -F 'checkpoint:<issue-number>:progress' "$REPO_ASSIST" >/dev/null; then
  echo "FAIL: repo-assist must not instruct file-per-stage checkpoints" >&2
  exit 1
fi

if rg -F 'checkpoint:<issue-number>:pre-pr' "$REPO_ASSIST" >/dev/null; then
  echo "FAIL: repo-assist must not instruct file-per-stage checkpoints" >&2
  exit 1
fi

if rg -F 'frontend-checkpoint:<issue-number>:<stage>' "$FRONTEND_AGENT" >/dev/null; then
  echo "FAIL: frontend-agent must not instruct file-per-stage checkpoints" >&2
  exit 1
fi

echo "agent memory bounds tests passed"
