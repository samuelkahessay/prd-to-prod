#!/usr/bin/env bash
set -euo pipefail

# classify-ci-failure.sh — Deterministically classifies CI failures from log text.

LOG_TEXT=$(cat)
LOG_LOWER=$(printf '%s' "$LOG_TEXT" | tr '[:upper:]' '[:lower:]')

CATEGORY="unknown"
CONFIDENCE="low"
SUMMARY="Unknown CI failure"
SUGGESTED_ACTION="fix"

# Build/path errors checked first — they commonly co-occur with "token" in
# masked env-var output and must not be shadowed by the auth rule.
if [[ "$LOG_LOWER" =~ enoent|no\ such\ file|module\ not\ found ]]; then
  CATEGORY="build"
  CONFIDENCE="high"
  SUMMARY="Build failure: missing file or module"
  SUGGESTED_ACTION="fix"
elif [[ "$LOG_LOWER" =~ build|compile|tsc|error\ ts ]]; then
  CATEGORY="build"
  CONFIDENCE="high"
  SUMMARY="Build failure detected"
  SUGGESTED_ACTION="fix"
# Auth: match actual error codes/messages, NOT the word "token" which appears
# in every Actions run via masked env-var output (e.g. "VERCEL_TOKEN: ***").
elif [[ "$LOG_LOWER" =~ 403|401|resource\ not\ accessible|bad\ credentials|authentication\ failed|permission\ denied ]]; then
  CATEGORY="auth"
  CONFIDENCE="high"
  SUMMARY="Authentication or permission failure"
  SUGGESTED_ACTION="escalate"
elif [[ "$LOG_LOWER" =~ rate\ limit|429|quota ]]; then
  CATEGORY="rate-limit"
  CONFIDENCE="high"
  SUMMARY="Rate limit encountered"
  SUGGESTED_ACTION="retry"
elif [[ "$LOG_LOWER" =~ timeout ]]; then
  CATEGORY="timeout"
  CONFIDENCE="high"
  SUMMARY="CI job timed out"
  SUGGESTED_ACTION="retry"
elif [[ "$LOG_LOWER" =~ fail|failing|test ]]; then
  CATEGORY="test"
  CONFIDENCE="high"
  SUMMARY="Test failure detected"
  SUGGESTED_ACTION="fix"
elif [[ "$LOG_LOWER" =~ econnrefused|5[0-9][0-9]|service\ unavailable ]]; then
  CATEGORY="infrastructure"
  CONFIDENCE="high"
  SUMMARY="Infrastructure failure detected"
  SUGGESTED_ACTION="retry"
fi

jq -n \
  --arg category "$CATEGORY" \
  --arg confidence "$CONFIDENCE" \
  --arg summary "$SUMMARY" \
  --arg suggested_action "$SUGGESTED_ACTION" \
  --arg raw_error "$LOG_TEXT" \
  '{
    category: $category,
    confidence: $confidence,
    summary: $summary,
    suggested_action: $suggested_action,
    raw_error: $raw_error
  }'
