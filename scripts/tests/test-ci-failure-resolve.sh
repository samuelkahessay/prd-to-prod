#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/ci-failure-resolve.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F "pull_request:" "$WORKFLOW" >/dev/null
grep -F "types: [closed]" "$WORKFLOW" >/dev/null
grep -F "Close PR-scoped CI incident issues on successful CI" "$WORKFLOW" >/dev/null
grep -F "Close PR-scoped CI incident issues when the PR closes" "$WORKFLOW" >/dev/null
grep -F 'test("^\\[CI Incident\\](?: Escalation:)? PR #' "$WORKFLOW" >/dev/null

echo "ci-failure-resolve.yml tests passed"
