#!/usr/bin/env bash
set -euo pipefail

# validate-schema.sh — Validates JSON data against a JSON Schema
#
# Usage: validate-schema.sh <schema-file> [json-file|-]
# If json-file is omitted or -, reads from stdin.
# Exit 0 = valid, Exit 1 = invalid

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SCHEMA="${1:-}"
INPUT="${2:--}"

[ -n "$SCHEMA" ] || { echo "Usage: validate-schema.sh <schema-file> [json-file|-]" >&2; exit 2; }

# Resolve schema path relative to schemas/ directory if not absolute
if [[ "$SCHEMA" != /* ]]; then
  if [ -f "$SCRIPT_DIR/schemas/$SCHEMA" ]; then
    SCHEMA="$SCRIPT_DIR/schemas/$SCHEMA"
  elif [ -f "$SCHEMA" ]; then
    SCHEMA="$SCHEMA"
  else
    echo "FAIL: Schema file not found: $SCHEMA" >&2
    exit 2
  fi
fi

[ -f "$SCHEMA" ] || { echo "FAIL: Schema file not found: $SCHEMA" >&2; exit 2; }

# Read input
if [ "$INPUT" = "-" ]; then
  JSON_DATA=$(cat)
else
  [ -f "$INPUT" ] || { echo "FAIL: Input file not found: $INPUT" >&2; exit 2; }
  JSON_DATA=$(cat "$INPUT")
fi

# Validate JSON is parseable
if ! printf '%s' "$JSON_DATA" | jq empty 2>/dev/null; then
  echo "FAIL: Input is not valid JSON" >&2
  exit 1
fi

# Use python3 + jsonschema for validation (widely available)
if python3 -c "import jsonschema" 2>/dev/null; then
  RESULT=$(python3 -c "
import json, sys, jsonschema
schema = json.load(open('$SCHEMA'))
data = json.loads(sys.stdin.read())
try:
    jsonschema.validate(data, schema)
    print('VALID')
except jsonschema.ValidationError as e:
    print(f'INVALID: {e.message}', file=sys.stderr)
    sys.exit(1)
" <<< "$JSON_DATA" 2>&1) || {
    echo "$RESULT" >&2
    exit 1
  }
  exit 0
fi

# Fallback: basic structural validation with jq
# Check required fields exist (read them from schema)
REQUIRED=$(jq -r '.required[]? // empty' "$SCHEMA" 2>/dev/null || true)
if [ -n "$REQUIRED" ]; then
  while IFS= read -r field; do
    [ -z "$field" ] && continue
    if ! printf '%s' "$JSON_DATA" | jq -e "has(\"$field\")" >/dev/null 2>&1; then
      echo "FAIL: Missing required field: $field" >&2
      exit 1
    fi
  done <<< "$REQUIRED"
fi

# Check enum constraints for top-level fields
for field in $(jq -r '.properties | keys[]' "$SCHEMA" 2>/dev/null); do
  ENUM=$(jq -r ".properties[\"$field\"].enum // empty | .[]" "$SCHEMA" 2>/dev/null || true)
  if [ -n "$ENUM" ]; then
    VALUE=$(printf '%s' "$JSON_DATA" | jq -r ".[\"$field\"]" 2>/dev/null || true)
    if [ -n "$VALUE" ] && [ "$VALUE" != "null" ]; then
      if ! echo "$ENUM" | grep -qxF "$VALUE"; then
        echo "FAIL: Field '$field' value '$VALUE' not in allowed enum" >&2
        exit 1
      fi
    fi
  fi
done

exit 0
