#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--changed-files FILE_LIST] [log-file]" >&2
  exit 1
}

CHANGED_FILES=""
POSITIONAL=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --changed-files)
      CHANGED_FILES="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [ "${#POSITIONAL[@]}" -gt 1 ]; then
  usage
fi

if [ "${#POSITIONAL[@]}" -eq 1 ]; then
  RAW_LOGS=$(cat "${POSITIONAL[0]}")
else
  RAW_LOGS=$(cat)
fi

RAW_LOGS=$(printf '%s' "$RAW_LOGS" | tr '\r' '\n')

clean_line() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | tr '\t' ' ' | sed 's/  \+/ /g'
}

summary_line() {
  local cleaned
  cleaned=$(clean_line "$1")

  if printf '%s\n' "$cleaned" | grep -qiE 'error (CS|FS|BC)[0-9]+'; then
    printf '%s\n' "$cleaned" | sed -E 's/^.*(error (CS|FS|BC)[0-9]+:?[[:space:]].*)$/\1/I'
    return
  fi

  if printf '%s\n' "$cleaned" | grep -qE '(^|[[:space:]])Failed[[:space:]][^[:space:]]+'; then
    printf '%s\n' "$cleaned" | sed -E 's/^.*((^|[[:space:]])Failed[[:space:]][^[:space:]].*)$/\1/'
    return
  fi

  if printf '%s\n' "$cleaned" | grep -qE '(Error Message:|Expected:|Actual:|Assert|xUnit)'; then
    printf '%s\n' "$cleaned" | sed -E 's/^.*((Error Message:|Expected:|Actual:|Assert|xUnit).*)$/\1/'
    return
  fi

  printf '%s\n' "$cleaned"
}

sanitize_signature() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/\[[^]]*\]//g' \
    | tr -cs 'a-z0-9' '-' \
    | sed 's/^-//; s/-$//' \
    | cut -c1-80
}

first_nonempty() {
  awk 'NF { print; exit }'
}

CODE_LINE=$(printf '%s\n' "$RAW_LOGS" | grep -iEm1 'error (CS|FS|BC)[0-9]+' || true)
TEST_LINE=$(printf '%s\n' "$RAW_LOGS" | grep -Em1 '(^|[[:space:]])Failed[[:space:]][^[:space:]]+' || true)
ASSERT_LINE=$(printf '%s\n' "$RAW_LOGS" | grep -Em1 '(Error Message:|Expected:|Actual:|Assert|xUnit)' || true)
FALLBACK_LINE=$(printf '%s\n' "$RAW_LOGS" | first_nonempty || true)

FAILURE_TYPE="unknown"
FAILURE_SIGNATURE="unknown-failure"
SUMMARY="Unknown failure"
EXCERPT=""

STRUCTURED_PATTERNS='error (CS|FS|BC)[0-9]+|Build FAILED|Tests? failed|(^|[[:space:]])Failed[[:space:]][^[:space:]]+|Error Message:|Stack Trace:|Expected:|Actual:|Assert|xUnit'

if [ -n "$CODE_LINE" ]; then
  FAILURE_TYPE="build"
  FIRST_CODE=$(printf '%s\n' "$CODE_LINE" | grep -oiEm1 'error (CS|FS|BC)[0-9]+' | tr '[:upper:]' '[:lower:]' | sed 's/^error //')
  CODE_CONTEXT=$(printf '%s\n' "$CODE_LINE" | sed -E 's/.*error (CS|FS|BC)[0-9]+:?[[:space:]]*//I' | sed 's/\[[^]]*\]//g')
  CODE_CONTEXT_SIG=$(sanitize_signature "$CODE_CONTEXT")
  FAILURE_SIGNATURE="$FIRST_CODE"
  if [ -n "$CODE_CONTEXT_SIG" ]; then
    FAILURE_SIGNATURE="${FAILURE_SIGNATURE}-${CODE_CONTEXT_SIG}"
  fi
  SUMMARY=$(summary_line "$CODE_LINE")
  EXCERPT=$(printf '%s\n' "$RAW_LOGS" | grep -iE "$STRUCTURED_PATTERNS" | head -20 || true)
elif [ -n "$TEST_LINE" ]; then
  FAILURE_TYPE="test"
  TEST_NAME=$(printf '%s\n' "$TEST_LINE" | sed -E 's/^.*Failed[[:space:]]+//; s/[[:space:]]+\[[^]]*\].*$//')
  TEST_NAME_SIG=$(sanitize_signature "$TEST_NAME")
  if [ -n "$TEST_NAME_SIG" ]; then
    FAILURE_SIGNATURE="test-${TEST_NAME_SIG}"
  fi
  SUMMARY=$(summary_line "$TEST_LINE")
  EXCERPT=$(printf '%s\n' "$RAW_LOGS" | grep -E "$STRUCTURED_PATTERNS" | head -20 || true)
elif [ -n "$ASSERT_LINE" ]; then
  FAILURE_TYPE="test"
  FAILURE_SIGNATURE="test-assertion-failure"
  SUMMARY=$(summary_line "$ASSERT_LINE")
  EXCERPT=$(printf '%s\n' "$RAW_LOGS" | grep -E "$STRUCTURED_PATTERNS" | head -20 || true)
else
  SUMMARY=$(summary_line "${FALLBACK_LINE:-Unknown failure}")
  SUMMARY=${SUMMARY:-Unknown failure}
  EXCERPT=$(printf '%s\n' "$RAW_LOGS" | head -20 || true)
fi

if [ -z "$EXCERPT" ]; then
  EXCERPT=${SUMMARY:-"(no failed-step logs found)"}
fi

SUMMARY=$(printf '%.140s' "$SUMMARY")

# --- Hypothesis generation (only when --changed-files provided) ---
HYPOTHESIS=""
CORRELATED_FILES="[]"

if [ -n "$CHANGED_FILES" ]; then
  # Extract file paths from error lines
  ERROR_FILES=$(printf '%s\n' "$RAW_LOGS" \
    | grep -oE '[A-Za-z0-9_./-]+\.(cs|ts|js|jsx|tsx|py|go|rs|java)' \
    | sort -u || true)

  if [ -n "$ERROR_FILES" ]; then
    MATCHED=()
    UNMATCHED=()

    while IFS= read -r efile; do
      [ -n "$efile" ] || continue
      FOUND=false
      while IFS= read -r cfile; do
        [ -n "$cfile" ] || continue
        if [ "$(basename "$cfile")" = "$(basename "$efile")" ]; then
          MATCHED+=("$cfile")
          FOUND=true
          break
        fi
      done <<< "$CHANGED_FILES"

      if [ "$FOUND" = "false" ]; then
        UNMATCHED+=("$efile")
      fi
    done <<< "$ERROR_FILES"

    if [ "${#MATCHED[@]}" -gt 0 ]; then
      MATCHED_LIST=$(printf '%s, ' "${MATCHED[@]}" | sed 's/, $//')
      HYPOTHESIS="Error references ${MATCHED_LIST} which was modified in this PR. The failure likely stems from these changes."
      CORRELATED_FILES=$(printf '%s\n' "${MATCHED[@]}" | jq -R . | jq -s .)
    elif [ "${#UNMATCHED[@]}" -gt 0 ]; then
      UNMATCHED_LIST=$(printf '%s, ' "${UNMATCHED[@]}" | sed 's/, $//')
      HYPOTHESIS="Error references ${UNMATCHED_LIST} which was NOT directly modified in this PR — possible downstream dependency breakage."
      CORRELATED_FILES="[]"
    fi
  fi
fi

jq -n \
  --arg failure_type "$FAILURE_TYPE" \
  --arg failure_signature "$FAILURE_SIGNATURE" \
  --arg summary "$SUMMARY" \
  --arg excerpt "$EXCERPT" \
  --arg hypothesis "$HYPOTHESIS" \
  --argjson correlated_files "$CORRELATED_FILES" \
  '{
    failure_type: $failure_type,
    failure_signature: $failure_signature,
    summary: $summary,
    excerpt: $excerpt,
    hypothesis: (if $hypothesis == "" then null else $hypothesis end),
    correlated_files: $correlated_files
  }'
