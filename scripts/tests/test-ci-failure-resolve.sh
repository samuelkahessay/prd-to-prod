#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/ci-failure-resolve.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F 'workflows: ["Node CI", "Deploy Router", "Pipeline Scripts CI"]' "$WORKFLOW" >/dev/null
grep -F 'WORKFLOW_NAME: ${{ github.event.workflow_run.name }}' "$WORKFLOW" >/dev/null
grep -F 'workflow_name=${WORKFLOW_NAME}' "$WORKFLOW" >/dev/null
grep -F 'MARKER_WORKFLOW_NAME=$(read_marker_field "$STATE_BODY" workflow_name)' "$WORKFLOW" >/dev/null
grep -F 'if [ -n "$MARKER_WORKFLOW_NAME" ] && [ "$MARKER_WORKFLOW_NAME" != "$WORKFLOW_NAME" ]; then' "$WORKFLOW" >/dev/null
grep -F "pull_request:" "$WORKFLOW" >/dev/null
grep -F "types: [closed]" "$WORKFLOW" >/dev/null
grep -F "Close PR-scoped CI incident issues on successful CI" "$WORKFLOW" >/dev/null
grep -F "Close PR-scoped CI incident issues when the PR closes" "$WORKFLOW" >/dev/null
grep -F 'test("^\\[CI Incident\\](?: Escalation:)? PR #' "$WORKFLOW" >/dev/null

echo "ci-failure-resolve.yml tests passed"
