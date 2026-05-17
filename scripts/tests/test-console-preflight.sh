#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

OUTPUT=$(cd "$ROOT_DIR" && node - <<'NODE'
const { runPreflight } = require("./console/lib/preflight");
console.log(JSON.stringify(runPreflight(process.cwd())));
NODE
)

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "copilot" and .required == true)' >/dev/null || {
  echo "FAIL: preflight must include required Copilot engine token check" >&2
  exit 1
}

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "openrouter" and .required == false)' >/dev/null || {
  echo "FAIL: preflight must keep OpenRouter as optional legacy support" >&2
  exit 1
}

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "gh-aw-github-token" and .required == true)' >/dev/null || {
  echo "FAIL: preflight must include the workflow dispatch token check" >&2
  exit 1
}

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "pipeline-app-id" and .required == true)' >/dev/null || {
  echo "FAIL: preflight must include the pipeline app id check" >&2
  exit 1
}

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "deploy-profile" and .required == true)' >/dev/null || {
  echo "FAIL: preflight must include the deploy profile check" >&2
  exit 1
}

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "workiq" and .required == false)' >/dev/null || {
  echo "FAIL: preflight must treat WorkIQ as optional" >&2
  exit 1
}

echo "console preflight tests passed"
