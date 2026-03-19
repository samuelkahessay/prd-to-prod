#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/ci-failure-issue.yml"

grep -F 'workflows: ["Node CI", "Deploy Router", "Pipeline Scripts CI"]' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must monitor Pipeline Scripts CI" >&2
  exit 1
}

grep -F 'scripts/classify-ci-failure.sh' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must sparse-checkout classify-ci-failure.sh" >&2
  exit 1
}

grep -F 'WORKFLOW_NAME: ${{ github.event.workflow_run.name }}' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must capture workflow_run.name" >&2
  exit 1
}

grep -F "CLASSIFICATION_JSON=\$(printf '%s' \"\$RAW_LOGS\" | .workflow-helpers/scripts/classify-ci-failure.sh)" "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must invoke classify-ci-failure.sh" >&2
  exit 1
}

grep -F 'if [ "$CLASSIFIER_ACTION" = "escalate" ]; then' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must special-case escalated classifier results" >&2
  exit 1
}

grep -F 'TITLE="[Pipeline] CI Failure (${FAILURE_TYPE}): ${SHORT_SUMMARY}"' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must include classifier category in pipeline issue titles" >&2
  exit 1
}

grep -F 'workflow_name=${WORKFLOW_NAME}' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must store the failing workflow in repair state" >&2
  exit 1
}

grep -F 'contains("workflow_name=" + $workflow)' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must de-dupe repair commands by workflow name" >&2
  exit 1
}

grep -F -- '--workflow-name "$WORKFLOW_NAME"' "$WORKFLOW" >/dev/null || {
  echo "FAIL: ci-failure-issue.yml must pass workflow name into repair commands" >&2
  exit 1
}

echo "ci-failure-router v2 tests passed"
