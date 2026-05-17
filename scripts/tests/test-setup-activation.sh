#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

for workflow in code-simplifier duplicate-code-detector pipeline-status repo-assist; do
  file="$ROOT_DIR/.github/workflows/${workflow}.md"
  grep -F "vars.PIPELINE_ENABLED == 'true'" "$file" >/dev/null || {
    echo "FAIL: ${workflow}.md must gate scheduled runs on PIPELINE_ENABLED" >&2
    exit 1
  }
done

grep -F "gh variable set PIPELINE_ENABLED --body \"false\"" "$ROOT_DIR/scripts/bootstrap.sh" >/dev/null || {
  echo "FAIL: bootstrap.sh must initialize PIPELINE_ENABLED=false for unverified repos" >&2
  exit 1
}

grep -F "gh variable set PIPELINE_ENABLED --body \"true\"" "$ROOT_DIR/setup.sh" >/dev/null || {
  echo "FAIL: setup.sh must activate PIPELINE_ENABLED=true after setup readiness checks" >&2
  exit 1
}

grep -F "Variable 'PIPELINE_ENABLED' is true" "$ROOT_DIR/setup-verify.sh" >/dev/null || {
  echo "FAIL: setup-verify.sh must enforce PIPELINE_ENABLED=true" >&2
  exit 1
}

grep -F "Secret 'COPILOT_GITHUB_TOKEN' is set" "$ROOT_DIR/setup-verify.sh" >/dev/null || {
  echo "FAIL: setup-verify.sh must enforce COPILOT_GITHUB_TOKEN" >&2
  exit 1
}

grep -F "gh variable set PIPELINE_ENABLED --repo" "$ROOT_DIR/trigger/push-to-pipeline.sh" >/dev/null || {
  echo "FAIL: greenfield provisioning must set PIPELINE_ENABLED on generated repos" >&2
  exit 1
}

for file in README.md README.template.md docs/ARCHITECTURE.md; do
  grep -F "PIPELINE_ENABLED=true" "$ROOT_DIR/$file" >/dev/null || {
    echo "FAIL: $file must document setup activation" >&2
    exit 1
  }
done

echo "setup activation tests passed"
