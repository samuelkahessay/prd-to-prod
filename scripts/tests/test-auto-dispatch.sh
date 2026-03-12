#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/auto-dispatch.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F "contains(github.event.issue.labels.*.name, 'pipeline')" "$WORKFLOW" >/dev/null

if grep -F "contains(github.event.issue.labels.*.name, 'feature')" "$WORKFLOW" >/dev/null; then
  echo "FAIL: auto-dispatch gate should not require feature label in the workflow condition" >&2
  exit 1
fi

grep -F "scripts/classify-pipeline-issue.sh" "$WORKFLOW" >/dev/null
grep -F "steps.classify.outputs.actionable == 'true'" "$WORKFLOW" >/dev/null
grep -F 'steps.classify.outputs.route == '\''needs_human'\''' "$WORKFLOW" >/dev/null
grep -F 'steps.classify.outputs.route == '\''retry_with_backoff'\''' "$WORKFLOW" >/dev/null
grep -F 'sleep "${{ steps.classify.outputs.backoff_seconds }}"' "$WORKFLOW" >/dev/null

echo "auto-dispatch.yml tests passed"
