#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/auto-dispatch-requeue.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F 'workflow_run.name == '\''Pipeline Repo Assist'\''' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must scope transient retries to Pipeline Repo Assist" >&2
  exit 1
}

grep -F "<!-- provider-retry:v1" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must record provider retry markers" >&2
  exit 1
}

grep -F "Auto-retrying issue #\${ISSUE_NUMBER} after a transient provider failure" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must explain automatic transient retries" >&2
  exit 1
}

grep -F 'gh workflow run "$WORKFLOW_FILE" \' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must dispatch the owning workflow" >&2
  exit 1
}

grep -F -- '-f issue_number="$ISSUE_NUMBER"' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must target the same issue when retrying repo-assist" >&2
  exit 1
}

grep -F "<!-- self-healing-dispatch-outcome:v1" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must inspect targeted dispatch outcome markers" >&2
  exit 1
}

grep -F 'MAX_STALE_REDISPATCHES=3' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must cap stale re-dispatch loops" >&2
  exit 1
}

grep -F 'gh run view "$run_id" --repo "$REPO" --json status,conclusion' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must inspect the linked agent run state before treating a dispatch marker as terminal" >&2
  exit 1
}

echo "auto-dispatch-requeue.yml tests passed"
