#!/usr/bin/env bash
set -euo pipefail

# run.sh — Unified extraction entrypoint
#
# Routes to greenfield (extract-prd.sh) or existing (extract-issues.sh + push-to-existing.sh)
# based on --mode flag, TARGET_REPO environment variable, and classifier output.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sha256_of_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    python3 - "$1" <<'PY'
import hashlib
import pathlib
import sys
print(hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())
PY
  fi
}

sha256_of_string() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{print $1}'
  else
    python3 - <<'PY'
import hashlib
import sys
print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())
PY
  fi
}

MODE="auto"
TRANSCRIPT_FILE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    *)
      TRANSCRIPT_FILE="$1"
      shift
      ;;
  esac
done

case "$MODE" in
  auto|greenfield|existing) ;;
  *) echo "ERROR: Invalid mode '$MODE' — must be auto, greenfield, or existing" >&2; exit 1 ;;
esac

TARGET_REPO="${TARGET_REPO:-}"

route_greenfield() {
  "$SCRIPT_DIR/extract-prd.sh" ${TRANSCRIPT_FILE:+"$TRANSCRIPT_FILE"}
}

route_existing() {
  local tmpdir issues_file transcript_hash meeting_source

  tmpdir="$(mktemp -d)"
  issues_file="$tmpdir/issues.json"

  cleanup_existing_route() {
    rm -rf "$tmpdir"
  }
  trap cleanup_existing_route RETURN

  "$SCRIPT_DIR/extract-issues.sh" ${TRANSCRIPT_FILE:+"$TRANSCRIPT_FILE"} > "$issues_file"

  if [ -n "${PIPELINE_TRANSCRIPT_HASH:-}" ]; then
    transcript_hash="$PIPELINE_TRANSCRIPT_HASH"
  elif [ -n "$TRANSCRIPT_FILE" ] && [ -f "$TRANSCRIPT_FILE" ]; then
    transcript_hash="$(sha256_of_file "$TRANSCRIPT_FILE")"
  else
    transcript_hash="$(sha256_of_string "$(cat "$issues_file")")"
  fi

  meeting_source="${PIPELINE_MEETING_SOURCE:-}"
  if [ -z "$meeting_source" ] && [ -n "$TRANSCRIPT_FILE" ]; then
    meeting_source="$(basename "$TRANSCRIPT_FILE")"
  fi

  PIPELINE_TRANSCRIPT_HASH="$transcript_hash" \
  PIPELINE_MEETING_SOURCE="$meeting_source" \
  "$SCRIPT_DIR/../trigger/push-to-existing.sh" "$issues_file"
}

if [ "$MODE" = "existing" ] && [ -z "$TARGET_REPO" ]; then
  echo "ERROR: TARGET_REPO required when --mode existing is set" >&2
  exit 1
fi

if [ -n "$TARGET_REPO" ]; then
  if [ "$MODE" = "greenfield" ]; then
    route_greenfield
  else
    route_existing
  fi
  exit $?
fi

if [ "$MODE" = "greenfield" ]; then
  route_greenfield
  exit $?
fi

CLASSIFY_OUTPUT=$("$SCRIPT_DIR/classify.sh" ${TRANSCRIPT_FILE:+"$TRANSCRIPT_FILE"})
CLASSIFICATION=$(printf '%s' "$CLASSIFY_OUTPUT" | jq -r '.classification')
CONFIDENCE=$(printf '%s' "$CLASSIFY_OUTPUT" | jq -r '.confidence')
PRODUCT_MATCH=$(printf '%s' "$CLASSIFY_OUTPUT" | jq -r '.product_match // empty')

case "$CLASSIFICATION" in
  greenfield)
    route_greenfield
    ;;
  existing)
    if [ "$CONFIDENCE" = "high" ]; then
      if [ -n "$PRODUCT_MATCH" ]; then
        echo "Classification returned 'existing' but TARGET_REPO is not set. Suggestion: TARGET_REPO=$PRODUCT_MATCH" >&2
      else
        echo "Classification returned 'existing' but TARGET_REPO is not set" >&2
      fi
      exit 1
    else
      if [ -n "$PRODUCT_MATCH" ]; then
        echo "Low-confidence 'existing' classification — defaulting to greenfield. Consider: TARGET_REPO=$PRODUCT_MATCH" >&2
      else
        echo "Low-confidence 'existing' classification — defaulting to greenfield" >&2
      fi
      route_greenfield
    fi
    ;;
  *)
    echo "ERROR: Unknown classification: $CLASSIFICATION" >&2
    exit 1
    ;;
esac
