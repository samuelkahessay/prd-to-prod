#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW_MD="$ROOT_DIR/.github/workflows/duplicate-code-detector.md"
WORKFLOW_LOCK="$ROOT_DIR/.github/workflows/duplicate-code-detector.lock.yml"

if grep -F "assignees: copilot" "$WORKFLOW_MD" >/dev/null; then
  echo "FAIL: duplicate-code-detector.md should not auto-assign Copilot" >&2
  exit 1
fi

if grep -F "**Assignee**: @copilot" "$WORKFLOW_MD" >/dev/null; then
  echo "FAIL: duplicate-code-detector.md should not instruct Copilot assignment in the issue body" >&2
  exit 1
fi

if grep -F "Assign issue to @copilot for automated remediation" "$WORKFLOW_MD" >/dev/null; then
  echo "FAIL: duplicate-code-detector.md should leave issues unassigned for pipeline routing" >&2
  exit 1
fi

if grep -F '"assignees":["copilot"]' "$WORKFLOW_LOCK" >/dev/null; then
  echo "FAIL: duplicate-code-detector.lock.yml should not auto-assign Copilot" >&2
  exit 1
fi

grep -F 'GH_AW_ASSIGN_COPILOT: "false"' "$WORKFLOW_LOCK" >/dev/null

echo "duplicate-code-detector workflow tests passed"
