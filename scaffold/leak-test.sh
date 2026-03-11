#!/usr/bin/env bash
set -euo pipefail

# leak-test.sh — Verifies no forbidden paths leaked into dist/scaffold/
#
# Reads forbidden_paths and exception_paths from template-manifest.yml.
# Fails if any forbidden path appears in the scaffold output (unless excepted).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SCRIPT_DIR/template-manifest.yml"
OUTPUT_DIR="$REPO_ROOT/dist/scaffold"

[ -d "$OUTPUT_DIR" ] || { echo "FAIL: run export-scaffold.sh first" >&2; exit 1; }
[ -f "$MANIFEST" ] || { echo "FAIL: Manifest not found: $MANIFEST" >&2; exit 1; }

if ! command -v yq >/dev/null 2>&1; then
  echo "FAIL: yq is required but not installed" >&2
  exit 1
fi

ERRORS=0

# Load exception paths into an array
EXCEPTIONS=()
while IFS= read -r exc; do
  [ -z "$exc" ] && continue
  EXCEPTIONS+=("$(echo "$exc" | xargs)")
done < <(yq -r '.exception_paths[]' "$MANIFEST" 2>/dev/null)

is_excepted() {
  local path="$1"
  for exc in "${EXCEPTIONS[@]}"; do
    # Check if the leaked path matches an exception
    if [[ "$path" == "$exc" || "$path" == "$exc"* ]]; then
      return 0
    fi
  done
  return 1
}

# Check each forbidden path
while IFS= read -r forbidden; do
  [ -z "$forbidden" ] && continue
  forbidden=$(echo "$forbidden" | xargs)

  # Check if any file in scaffold matches this forbidden path
  if [ -d "$OUTPUT_DIR/$forbidden" ]; then
    # Directory exists — check if all contents are excepted
    while IFS= read -r leaked_file; do
      rel_path="${leaked_file#$OUTPUT_DIR/}"
      if ! is_excepted "$rel_path"; then
        echo "LEAK: forbidden path found in scaffold: $rel_path (forbidden: $forbidden)"
        ((ERRORS++))
      fi
    done < <(find "$OUTPUT_DIR/$forbidden" -type f 2>/dev/null)
  elif [ -f "$OUTPUT_DIR/$forbidden" ]; then
    rel_path="${forbidden}"
    if ! is_excepted "$rel_path"; then
      echo "LEAK: forbidden file found in scaffold: $rel_path"
      ((ERRORS++))
    fi
  fi
done < <(yq -r '.forbidden_paths[]' "$MANIFEST" 2>/dev/null)

# Additional check: no .env files anywhere in scaffold
while IFS= read -r env_file; do
  echo "LEAK: .env file found in scaffold: ${env_file#$OUTPUT_DIR/}"
  ((ERRORS++))
done < <(find "$OUTPUT_DIR" -name "*.env" -o -name ".env*" 2>/dev/null | grep -v node_modules || true)

# Additional check: no secrets or credentials files
while IFS= read -r secret_file; do
  echo "LEAK: potential secret file in scaffold: ${secret_file#$OUTPUT_DIR/}"
  ((ERRORS++))
done < <(find "$OUTPUT_DIR" -name "credentials*" -o -name "*.pem" -o -name "*.key" 2>/dev/null || true)

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS leak(s) detected in scaffold"
  exit 1
fi

echo "Leak test passed: no forbidden paths in scaffold"
