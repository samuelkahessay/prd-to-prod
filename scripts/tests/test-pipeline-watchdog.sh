#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/pipeline-watchdog.sh"
WORKFLOW="$ROOT_DIR/.github/workflows/pipeline-watchdog.yml"

bash -n "$SCRIPT"

grep -F "run: bash scripts/pipeline-watchdog.sh" "$WORKFLOW" >/dev/null
grep -F "workflow_active_runs()" "$SCRIPT" >/dev/null
grep -F "workflow_for_branch()" "$SCRIPT" >/dev/null
grep -F "command_for_branch()" "$SCRIPT" >/dev/null
grep -F "find_marker_comments()" "$SCRIPT" >/dev/null
grep -F "sync_pr_repair_labels()" "$SCRIPT" >/dev/null
grep -F 'workflow_name=${workflow_name}' "$SCRIPT" >/dev/null
grep -F -- '--workflow-name "$FAILURE_WORKFLOW_NAME"' "$SCRIPT" >/dev/null

if grep -F "Skipping watchdog actions." "$SCRIPT" >/dev/null; then
  echo "FAIL: watchdog should not short-circuit all work when any agent is active" >&2
  exit 1
fi

echo "pipeline-watchdog.sh tests passed"
