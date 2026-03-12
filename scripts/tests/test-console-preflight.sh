#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

OUTPUT=$(cd "$ROOT_DIR" && node - <<'NODE'
const { runPreflight } = require("./console/lib/preflight");
console.log(JSON.stringify(runPreflight(process.cwd())));
NODE
)

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "openrouter")' >/dev/null || {
  echo "FAIL: preflight must include openrouter check" >&2
  exit 1
}

printf '%s' "$OUTPUT" | jq -e '.[] | select(.id == "workiq" and .required == false)' >/dev/null || {
  echo "FAIL: preflight must treat WorkIQ as optional" >&2
  exit 1
}

echo "console preflight tests passed"
