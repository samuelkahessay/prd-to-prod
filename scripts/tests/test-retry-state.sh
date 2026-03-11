#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/validate-schema.sh"
SCHEMA="$ROOT_DIR/extraction/schemas/retry-state.json"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet" >&2
  exit 1
fi

VALID='{"retryCounts":{"criterion-login":1,"criterion-save":0},"lastAttempt":"2026-03-11T14:30:00Z","lastVerdict":"FAIL","failedCriteria":["criterion-login"]}'
if ! printf '%s' "$VALID" | bash "$SCRIPT" "$SCHEMA" - >/dev/null; then
  echo "FAIL: Test 1: valid retry state should pass schema validation" >&2
  exit 1
fi
echo "Test 1 passed: valid retry state passes"

INVALID='{"retry_count":1,"max_retries":2,"last_error":"oops"}'
if printf '%s' "$INVALID" | bash "$SCRIPT" "$SCHEMA" - >/dev/null 2>&1; then
  echo "FAIL: Test 2: legacy retry-state shape should fail" >&2
  exit 1
fi
echo "Test 2 passed: legacy retry state rejected"

BAD_COUNTS='{"retryCounts":{"criterion-login":-1}}'
if printf '%s' "$BAD_COUNTS" | bash "$SCRIPT" "$SCHEMA" - >/dev/null 2>&1; then
  echo "FAIL: Test 3: negative retry count should fail" >&2
  exit 1
fi
echo "Test 3 passed: negative retry count rejected"

echo "retry-state tests passed"
