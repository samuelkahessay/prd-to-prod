#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
MANIFEST="$ROOT_DIR/scaffold/template-manifest.yml"

# RED guard — manifest must exist before this test is meaningful
if [ ! -f "$MANIFEST" ]; then
  echo "RED: $MANIFEST does not exist yet — test defines the contract" >&2
  exit 1
fi

# Requires yq for YAML parsing
if ! command -v yq >/dev/null 2>&1; then
  echo "SKIP: yq not installed — cannot parse manifest" >&2
  exit 0
fi

ERRORS=0

# Extract include paths from manifest and verify each exists
while IFS= read -r path; do
  # Skip empty lines
  [ -z "$path" ] && continue

  # Trim whitespace
  path=$(echo "$path" | xargs)

  # Handle glob/directory patterns — check that at least one match exists
  if [[ "$path" == */ ]]; then
    # Directory pattern: check directory exists
    if [ ! -d "$ROOT_DIR/$path" ]; then
      echo "FAIL: manifest include directory not found: $path"
      ((ERRORS++))
    fi
  elif [[ "$path" == *"*"* ]]; then
    # Glob pattern: check at least one match
    matches=$(find "$ROOT_DIR" -path "$ROOT_DIR/$path" 2>/dev/null | head -1)
    if [ -z "$matches" ]; then
      echo "FAIL: manifest include glob has no matches: $path"
      ((ERRORS++))
    fi
  else
    # Exact file: check existence
    if [ ! -e "$ROOT_DIR/$path" ]; then
      echo "FAIL: manifest include path not found: $path"
      ((ERRORS++))
    fi
  fi
done < <(yq -r '.include[]' "$MANIFEST" 2>/dev/null)

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS manifest include paths not found in repo"
  exit 1
fi

echo "manifest-completeness tests passed"
