#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/validate.sh"

# RED guard — test defines the contract before implementation exists
if [ ! -f "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

FIXTURES="$ROOT_DIR/extraction/test-fixtures/prd"

# ── Test 1: Valid PRD passes ────────────────────────────────────

source "$SCRIPT"
if ! validate_prd "$FIXTURES/valid-prd.md"; then
  echo "FAIL: Test 1: valid-prd.md should pass validation" >&2
  exit 1
fi
echo "Test 1 passed: valid PRD accepted"

# ── Test 2: Invalid PRD fails ──────────────────────────────────

if validate_prd "$FIXTURES/invalid-prd.md" 2>/dev/null; then
  echo "FAIL: Test 2: invalid-prd.md should fail validation" >&2
  exit 1
fi
echo "Test 2 passed: invalid PRD rejected"

# ── Test 3: Missing file fails ─────────────────────────────────

if validate_prd "/nonexistent/prd.md" 2>/dev/null; then
  echo "FAIL: Test 3: missing file should fail validation" >&2
  exit 1
fi
echo "Test 3 passed: missing file rejected"

# ── Test 4: Direct invocation mode ─────────────────────────────

if ! bash "$SCRIPT" "$FIXTURES/valid-prd.md" >/dev/null 2>&1; then
  echo "FAIL: Test 4: direct invocation with valid PRD should pass" >&2
  exit 1
fi
echo "Test 4 passed: direct invocation works"

# ── Test 5: Direct invocation rejects invalid ──────────────────

if bash "$SCRIPT" "$FIXTURES/invalid-prd.md" >/dev/null 2>&1; then
  echo "FAIL: Test 5: direct invocation with invalid PRD should fail" >&2
  exit 1
fi
echo "Test 5 passed: direct invocation rejects invalid PRD"

echo "validate-prd tests passed"
