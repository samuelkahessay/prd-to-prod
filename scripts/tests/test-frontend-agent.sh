#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/frontend-agent.md"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F 'name: frontend-agent' "$WORKFLOW" >/dev/null
grep -F 'reaction: "rocket"' "$WORKFLOW" >/dev/null
grep -F 'List open issues labeled `pipeline` + `frontend` + (`feature`, `test`, `infra`, `docs`, or `bug`).' "$WORKFLOW" >/dev/null
grep -F 'Choose the oldest actionable frontend issue with no open/merged covering PR.' "$WORKFLOW" >/dev/null
grep -F 'If no actionable `frontend + pipeline` issue exists, call `noop` with a brief explanation and stop.' "$WORKFLOW" >/dev/null
grep -F 'frontend-agent/issue-<N>-<short-desc>' "$WORKFLOW" >/dev/null

echo "frontend-agent.md tests passed"
