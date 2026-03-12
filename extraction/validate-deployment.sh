#!/usr/bin/env bash
set -euo pipefail

# validate-deployment.sh — Produces a schema-valid deployment validation result.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[ -n "${DEPLOYMENT_URL:-}" ] || fail "DEPLOYMENT_URL required"
[ -n "${ISSUE_NUMBERS:-}" ] || fail "ISSUE_NUMBERS required"
[ -n "${REPO:-}" ] || fail "REPO required"

if ! HTTP_BODY=$(curl -fsS "$DEPLOYMENT_URL" 2>/dev/null); then
  OUTPUT=$(jq -n \
    --arg url "$DEPLOYMENT_URL" \
    --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    '{
      verdict: "FAIL",
      url: $url,
      timestamp: $timestamp,
      checks: [
        {
          name: "deployment-response",
          status: "fail",
          detail: "Deployment endpoint could not be fetched."
        }
      ]
    }')
  printf '%s' "$OUTPUT" | bash "$SCRIPT_DIR/validate-schema.sh" "$SCRIPT_DIR/schemas/validation-result.json" - >/dev/null
  printf '%s\n' "$OUTPUT"
  exit 2
fi

if printf '%s' "$HTTP_BODY" | jq empty >/dev/null 2>&1; then
  VERDICT="PASS"
  STATUS="pass"
  DETAIL="Deployment responded with valid JSON."
else
  VERDICT="FAIL"
  STATUS="fail"
  DETAIL="Deployment response was not valid JSON."
fi

OUTPUT=$(jq -n \
  --arg verdict "$VERDICT" \
  --arg url "$DEPLOYMENT_URL" \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg status "$STATUS" \
  --arg detail "$DETAIL" \
  '{
    verdict: $verdict,
    url: $url,
    timestamp: $timestamp,
    checks: [
      {
        name: "deployment-response",
        status: $status,
        detail: $detail
      }
    ]
  }')

printf '%s' "$OUTPUT" | bash "$SCRIPT_DIR/validate-schema.sh" "$SCRIPT_DIR/schemas/validation-result.json" - >/dev/null
printf '%s\n' "$OUTPUT"

if [ "$VERDICT" = "PASS" ]; then
  exit 0
fi

exit 1
