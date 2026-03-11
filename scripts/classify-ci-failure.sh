#!/usr/bin/env bash
set -euo pipefail

# classify-ci-failure.sh — Deterministically classifies CI failures from log text.

LOG_TEXT=$(cat)
LOG_LOWER=$(printf '%s' "$LOG_TEXT" | tr '[:upper:]' '[:lower:]')

CATEGORY="unknown"
CONFIDENCE="low"
SUMMARY="Unknown CI failure"
SUGGESTED_ACTION="fix"

if printf '%s' "$LOG_LOWER" | grep -Eq '403|401|resource not accessible|token|credentials'; then
  CATEGORY="auth"
  CONFIDENCE="high"
  SUMMARY="Authentication or permission failure"
  SUGGESTED_ACTION="escalate"
elif printf '%s' "$LOG_LOWER" | grep -Eq 'fail|failing|test'; then
  CATEGORY="test"
  CONFIDENCE="high"
  SUMMARY="Test failure detected"
  SUGGESTED_ACTION="fix"
elif printf '%s' "$LOG_LOWER" | grep -Eq 'rate limit|429|quota'; then
  CATEGORY="rate-limit"
  CONFIDENCE="high"
  SUMMARY="Rate limit encountered"
  SUGGESTED_ACTION="retry"
elif printf '%s' "$LOG_LOWER" | grep -Eq 'timeout'; then
  CATEGORY="timeout"
  CONFIDENCE="high"
  SUMMARY="CI job timed out"
  SUGGESTED_ACTION="retry"
elif printf '%s' "$LOG_LOWER" | grep -Eq 'build|compile|tsc|error ts'; then
  CATEGORY="build"
  CONFIDENCE="high"
  SUMMARY="Build failure detected"
  SUGGESTED_ACTION="fix"
elif printf '%s' "$LOG_LOWER" | grep -Eq 'econnrefused|5[0-9][0-9]|service unavailable'; then
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
