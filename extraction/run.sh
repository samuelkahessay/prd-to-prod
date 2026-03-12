#!/usr/bin/env bash
set -euo pipefail

# run.sh — Unified extraction entrypoint
#
# Routes to greenfield (extract-prd.sh) or existing (extract-issues.sh + push-to-existing.sh)
# based on --mode flag, TARGET_REPO environment variable, and classifier output.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

warn() {
  echo "WARN: $*" >&2
}

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

merge_gap_analysis() {
  python3 - "$1" "$2" <<'PY'
from pathlib import Path
import json
import sys

base_items = json.loads(Path(sys.argv[1]).read_text())
analyzed_items = json.loads(Path(sys.argv[2]).read_text())

if not isinstance(base_items, list) or not isinstance(analyzed_items, list):
    raise SystemExit("expected list inputs")
if len(base_items) != len(analyzed_items):
    raise SystemExit("item count mismatch")

severity_to_complexity = {
    "critical": "High",
    "major": "Medium",
    "minor": "Low",
}

merged = []
for index, base_item in enumerate(base_items):
    if not isinstance(base_item, dict):
        raise SystemExit(f"base item {index + 1} is not an object")
    analyzed_item = analyzed_items[index]
    if not isinstance(analyzed_item, dict):
        raise SystemExit(f"analyzed item {index + 1} is not an object")

    technical = dict(base_item.get("technical_notes") or {})
    gap = analyzed_item.get("gapAnalysis") or {}
    if isinstance(gap, dict):
        current_state = str(gap.get("currentState") or "").strip()
        gap_summary = str(gap.get("gap") or "").strip()
        suggested_action = str(gap.get("suggestedAction") or "").strip()
        affected_files = [
            str(path).strip()
            for path in (gap.get("affectedFiles") or [])
            if str(path).strip()
        ]
        severity = str(gap.get("severity") or "").strip().lower()

        if current_state:
            technical["current_state"] = current_state
        if gap_summary:
            technical["gap"] = gap_summary
        if severity and not str(technical.get("complexity") or "").strip():
            technical["complexity"] = severity_to_complexity.get(severity, "Medium")

        steps = [
            str(step).strip()
            for step in technical.get("implementation_steps", [])
            if str(step).strip()
        ]
        if suggested_action and suggested_action not in steps:
            steps.insert(0, suggested_action)
        if affected_files:
            file_step = "Review affected files: " + ", ".join(affected_files)
            if file_step not in steps:
                steps.append(file_step)
        if steps:
            technical["implementation_steps"] = steps[:8]

    merged_item = dict(base_item)
    merged_item["technical_notes"] = technical
    merged.append(merged_item)

print(json.dumps(merged, indent=2))
PY
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
  local tmpdir issues_file analyzed_file merged_file transcript_hash meeting_source

  tmpdir="$(mktemp -d)"
  issues_file="$tmpdir/issues.json"
  analyzed_file="$tmpdir/analyzed.json"
  merged_file="$tmpdir/issues.enriched.json"

  cleanup_existing_route() {
    rm -rf "$tmpdir"
  }
  trap cleanup_existing_route RETURN

  "$SCRIPT_DIR/extract-issues.sh" ${TRANSCRIPT_FILE:+"$TRANSCRIPT_FILE"} > "$issues_file"

  if [ -x "$SCRIPT_DIR/analyze-target.sh" ]; then
    if "$SCRIPT_DIR/analyze-target.sh" "$issues_file" > "$analyzed_file" 2>"$tmpdir/analyze-target.stderr"; then
      if merge_gap_analysis "$issues_file" "$analyzed_file" > "$merged_file" 2>"$tmpdir/merge-gap.stderr" && \
         printf '%s' "$(cat "$merged_file")" | bash "$SCRIPT_DIR/validate-schema.sh" "issues-output.json" - >/dev/null 2>&1; then
        issues_file="$merged_file"
      else
        warn "Target analysis output could not be merged; continuing with extracted issues"
      fi
    else
      warn "Target analysis failed; continuing with extracted issues"
    fi
  fi

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
