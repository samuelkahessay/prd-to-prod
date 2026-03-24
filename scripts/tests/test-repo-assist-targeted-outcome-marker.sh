#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/repo-assist.md"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F 'Before ending a targeted-dispatch run, leave exactly one structured outcome comment on the bound issue using `add_comment`.' "$WORKFLOW" >/dev/null || {
  echo "FAIL: repo-assist must require a targeted dispatch outcome comment" >&2
  exit 1
}

grep -F '<!-- self-healing-dispatch-outcome:v1' "$WORKFLOW" >/dev/null || {
  echo "FAIL: repo-assist must define the targeted dispatch outcome marker" >&2
  exit 1
}

grep -F 'agent_run_id=<workflow-run-id from GitHub context>' "$WORKFLOW" >/dev/null || {
  echo "FAIL: repo-assist outcome marker must bind to the workflow run id" >&2
  exit 1
}

grep -F 'outcome=<pr_created|blocked|already_covered|non_actionable|noop|missing_tool|missing_data|not_evaluated>' "$WORKFLOW" >/dev/null || {
  echo "FAIL: repo-assist outcome marker must enumerate the expected terminal outcomes" >&2
  exit 1
}

echo "repo-assist targeted outcome marker tests passed"
