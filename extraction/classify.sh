#!/usr/bin/env bash
set -euo pipefail

# classify.sh — Deterministic transcript classifier
#
# Classifies a meeting transcript as "greenfield" (new product) or
# "existing" (changes to an existing product).
#
# Input: stdin or file path argument
# Output: JSON to stdout
#   { "classification": "greenfield"|"existing",
#     "confidence": "high"|"low",
#     "signals": [...],
#     "product_match": null|"owner/repo" }
#
# Optional: --product-registry <file.json>
#   Maps product names to repos: {"acme-dashboard": "acme/dashboard"}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse arguments ──────────────────────────────────────────

PRODUCT_REGISTRY=""
INPUT_FILE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --product-registry)
      PRODUCT_REGISTRY="$2"
      shift 2
      ;;
    *)
      INPUT_FILE="$1"
      shift
      ;;
  esac
done

# ── Read transcript ──────────────────────────────────────────

if [ -n "$INPUT_FILE" ] && [ -f "$INPUT_FILE" ]; then
  TRANSCRIPT=$(cat "$INPUT_FILE")
else
  TRANSCRIPT=$(cat)
fi

# Normalize to lowercase for matching
TRANSCRIPT_LOWER=$(printf '%s' "$TRANSCRIPT" | tr '[:upper:]' '[:lower:]')

# ── Signal detection ─────────────────────────────────────────

GREENFIELD_SIGNALS=()
EXISTING_SIGNALS=()

# Greenfield signals: building something new
for pattern in "new app" "new product" "new service" "build a new" "start from scratch" "brand new" "create a" "let's build" "greenfield"; do
  if printf '%s' "$TRANSCRIPT_LOWER" | grep -q "$pattern"; then
    GREENFIELD_SIGNALS+=("$pattern")
  fi
done

# Existing signals: changing something that exists
for pattern in "update the" "fix the" "fix in" "broken" "current implementation" "existing repo" "existing service" "existing system" "the repo has" "our users" "v[0-9]" "the api" "add to the" "change the" "improve the"; do
  if printf '%s' "$TRANSCRIPT_LOWER" | grep -qE "$pattern"; then
    EXISTING_SIGNALS+=("$pattern")
  fi
done

# ── Product registry matching ────────────────────────────────

PRODUCT_MATCH="null"
if [ -n "$PRODUCT_REGISTRY" ] && [ -f "$PRODUCT_REGISTRY" ]; then
  # Check each product name against transcript
  while IFS= read -r product_name; do
    [ -z "$product_name" ] && continue
    product_lower=$(printf '%s' "$product_name" | tr '[:upper:]' '[:lower:]')
    if printf '%s' "$TRANSCRIPT_LOWER" | grep -q "$product_lower"; then
      repo=$(jq -r ".[\"$product_name\"]" "$PRODUCT_REGISTRY")
      if [ -n "$repo" ] && [ "$repo" != "null" ]; then
        PRODUCT_MATCH="\"$repo\""
        # Product match is a strong existing signal
        EXISTING_SIGNALS+=("product registry match: $product_name")
        break
      fi
    fi
  done < <(jq -r 'keys[]' "$PRODUCT_REGISTRY")
fi

# ── Classification logic ─────────────────────────────────────

GREENFIELD_COUNT=${#GREENFIELD_SIGNALS[@]}
EXISTING_COUNT=${#EXISTING_SIGNALS[@]}

if [ "$EXISTING_COUNT" -gt "$GREENFIELD_COUNT" ]; then
  CLASSIFICATION="existing"
  if [ "$EXISTING_COUNT" -ge 3 ] || [ "$PRODUCT_MATCH" != "null" ]; then
    CONFIDENCE="high"
  else
    CONFIDENCE="low"
  fi
  SIGNALS_ARRAY=$(printf '%s\n' "${EXISTING_SIGNALS[@]}" | jq -R . | jq -s .)
elif [ "$GREENFIELD_COUNT" -gt 0 ]; then
  CLASSIFICATION="greenfield"
  if [ "$GREENFIELD_COUNT" -ge 2 ] && [ "$EXISTING_COUNT" -eq 0 ]; then
    CONFIDENCE="high"
  else
    CONFIDENCE="low"
  fi
  SIGNALS_ARRAY=$(printf '%s\n' "${GREENFIELD_SIGNALS[@]}" | jq -R . | jq -s .)
else
  # No signals: default to greenfield with low confidence
  CLASSIFICATION="greenfield"
  CONFIDENCE="low"
  SIGNALS_ARRAY="[]"
fi

# ── Output ───────────────────────────────────────────────────

# Self-validation: ensure all 4 required fields present
OUTPUT=$(jq -n \
  --arg classification "$CLASSIFICATION" \
  --arg confidence "$CONFIDENCE" \
  --argjson signals "$SIGNALS_ARRAY" \
  --argjson product_match "$PRODUCT_MATCH" \
  '{classification: $classification, confidence: $confidence, signals: $signals, product_match: $product_match}')

# Verify output has all required fields
for field in classification confidence signals product_match; do
  if ! printf '%s' "$OUTPUT" | jq -e "has(\"$field\")" >/dev/null 2>&1; then
    echo "INTERNAL ERROR: classify.sh output missing field: $field" >&2
    exit 1
  fi
done

printf '%s\n' "$OUTPUT"
