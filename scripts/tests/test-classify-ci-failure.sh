#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/classify-ci-failure.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

AUTH_OUTPUT=$(printf 'Error: 403 Resource not accessible by integration\n' | bash "$SCRIPT")
printf '%s' "$AUTH_OUTPUT" | bash "$ROOT_DIR/extraction/validate-schema.sh" "$ROOT_DIR/extraction/schemas/ci-failure-output.json" - >/dev/null || {
  echo "FAIL: classifier output must match schema" >&2
  exit 1
}
printf '%s' "$AUTH_OUTPUT" | jq -e '.category == "auth" and .suggested_action == "escalate"' >/dev/null || {
  echo "FAIL: expected auth failure to escalate" >&2
  exit 1
}

TEST_OUTPUT=$(printf 'FAIL src/foo.test.ts\n' | bash "$SCRIPT")
printf '%s' "$TEST_OUTPUT" | jq -e '.category == "test" and .suggested_action == "fix"' >/dev/null || {
  echo "FAIL: expected test failure to be fixable" >&2
  exit 1
}

echo "classify-ci-failure tests passed"
