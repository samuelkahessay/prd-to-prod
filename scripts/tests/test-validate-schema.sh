#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/validate-schema.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet" >&2
  exit 1
fi

SCHEMA_DIR="$ROOT_DIR/extraction/schemas"
[ -f "$SCHEMA_DIR/classify-output.json" ] || { echo "RED: classify-output.json schema not found" >&2; exit 1; }

# Test 1: Valid classify output passes
VALID='{"classification":"greenfield","confidence":"high","signals":["new app"],"product_match":null}'
if ! printf '%s' "$VALID" | bash "$SCRIPT" "$SCHEMA_DIR/classify-output.json" -; then
  echo "FAIL: Test 1: valid classify output should pass" >&2; exit 1
fi
echo "Test 1 passed: valid input passes"

# Test 2: Missing required field fails
INVALID='{"classification":"greenfield","confidence":"high"}'
if printf '%s' "$INVALID" | bash "$SCRIPT" "$SCHEMA_DIR/classify-output.json" - 2>/dev/null; then
  echo "FAIL: Test 2: missing fields should fail" >&2; exit 1
fi
echo "Test 2 passed: missing field fails"

# Test 3: Bad enum value fails
BAD_ENUM='{"classification":"unknown","confidence":"high","signals":[],"product_match":null}'
if printf '%s' "$BAD_ENUM" | bash "$SCRIPT" "$SCHEMA_DIR/classify-output.json" - 2>/dev/null; then
  echo "FAIL: Test 3: bad enum should fail" >&2; exit 1
fi
echo "Test 3 passed: bad enum fails"

# Test 4: Malformed JSON fails
if printf 'not json' | bash "$SCRIPT" "$SCHEMA_DIR/classify-output.json" - 2>/dev/null; then
  echo "FAIL: Test 4: malformed JSON should fail" >&2; exit 1
fi
echo "Test 4 passed: malformed JSON fails"

echo "validate-schema tests passed"
