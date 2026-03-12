#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
MANIFEST="$ROOT_DIR/scaffold/template-manifest.yml"

# RED guard
if [ ! -f "$MANIFEST" ]; then
  echo "RED: $MANIFEST does not exist yet — test defines the contract" >&2
  exit 1
fi

if ! command -v yq >/dev/null 2>&1; then
  echo "SKIP: yq not installed — cannot parse manifest" >&2
  exit 0
fi

# ── Test 1: include is non-empty ────────────────────────────────

INCLUDE_COUNT=$(yq -r '.include | length' "$MANIFEST")
if [ "$INCLUDE_COUNT" -lt 1 ]; then
  echo "FAIL: Test 1: include array is empty" >&2
  exit 1
fi
echo "Test 1 passed: include has $INCLUDE_COUNT entries"

# ── Test 2: forbidden_paths has critical entries ────────────────

FORBIDDEN=$(yq -r '.forbidden_paths[]' "$MANIFEST")
for critical in "extraction/" "trigger/" "PRDtoProd/"; do
  if ! echo "$FORBIDDEN" | grep -qF "$critical"; then
    echo "FAIL: Test 2: forbidden_paths missing critical entry: $critical" >&2
    exit 1
  fi
done
echo "Test 2 passed: forbidden_paths has critical entries"

# ── Test 3: render has expected keys ────────────────────────────

if ! yq -e '.render.PROJECT_NAME' "$MANIFEST" >/dev/null 2>&1; then
  echo "FAIL: Test 3: render section missing PROJECT_NAME key" >&2
  exit 1
fi
echo "Test 3 passed: render has PROJECT_NAME"

# ── Test 4: exception_paths present ─────────────────────────────

EXC_COUNT=$(yq -r '.exception_paths | length' "$MANIFEST" 2>/dev/null || echo "0")
if [ "$EXC_COUNT" -lt 1 ]; then
  echo "FAIL: Test 4: exception_paths is empty or missing" >&2
  exit 1
fi
echo "Test 4 passed: exception_paths has $EXC_COUNT entries"

# ── Test 5: version field present ───────────────────────────────

VERSION=$(yq -r '.version' "$MANIFEST")
if [ "$VERSION" != "1" ]; then
  echo "FAIL: Test 5: expected version=1, got $VERSION" >&2
  exit 1
fi
echo "Test 5 passed: version=1"

echo "manifest-parse tests passed"
