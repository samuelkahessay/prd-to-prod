#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/check-autonomy-policy.sh"
POLICY="$ROOT_DIR/autonomy-policy.yml"

VALIDATE_JSON=$(bash "$SCRIPT" validate "$POLICY")
printf '%s' "$VALIDATE_JSON" | jq -e '.ok == true' >/dev/null
printf '%s' "$VALIDATE_JSON" | jq -e '.action_count >= 1' >/dev/null

WORKFLOW_JSON=$(bash "$SCRIPT" resolve workflow_file_change "$POLICY")
printf '%s' "$WORKFLOW_JSON" | jq -e '.found == true' >/dev/null
printf '%s' "$WORKFLOW_JSON" | jq -e '.mode == "human_required"' >/dev/null
printf '%s' "$WORKFLOW_JSON" | jq -e '.requires_human_reason | contains("routing and safety rules")' >/dev/null

UNKNOWN_JSON=$(bash "$SCRIPT" resolve some_unknown_action "$POLICY")
printf '%s' "$UNKNOWN_JSON" | jq -e '.found == false' >/dev/null
printf '%s' "$UNKNOWN_JSON" | jq -e '.mode == "human_required"' >/dev/null
printf '%s' "$UNKNOWN_JSON" | jq -e '.fail_closed == true' >/dev/null

WORKFLOW_MATCH_JSON=$(bash "$SCRIPT" match workflow_file_change ".github/workflows/auto-dispatch.yml" "$POLICY")
printf '%s' "$WORKFLOW_MATCH_JSON" | jq -e '.found == true' >/dev/null
printf '%s' "$WORKFLOW_MATCH_JSON" | jq -e '.matched == true' >/dev/null
printf '%s' "$WORKFLOW_MATCH_JSON" | jq -e '.mode == "human_required"' >/dev/null

APP_MATCH_JSON=$(bash "$SCRIPT" match app_code_change "web/components/landing/hero.tsx" "$POLICY")
printf '%s' "$APP_MATCH_JSON" | jq -e '.matched == true' >/dev/null
printf '%s' "$APP_MATCH_JSON" | jq -e '.mode == "autonomous"' >/dev/null

# --- Regression: sensitive_app_change must match the real auth boundary ---
SENSITIVE_FILES=(
  "console/server.js"
  "web/lib/api.ts"
)

for FILE in "${SENSITIVE_FILES[@]}"; do
  SENSITIVE_JSON=$(bash "$SCRIPT" match sensitive_app_change "$FILE" "$POLICY")
  printf '%s' "$SENSITIVE_JSON" | jq -e '.matched == true' >/dev/null || {
    echo "FAIL: sensitive_app_change should match $FILE" >&2
    exit 1
  }
  printf '%s' "$SENSITIVE_JSON" | jq -e '.mode == "human_required"' >/dev/null || {
    echo "FAIL: sensitive_app_change mode should be human_required for $FILE" >&2
    exit 1
  }
done

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat > "$TMPDIR/invalid-policy.yml" <<'YAML'
version: 1
defaults:
  unknown_action: human_required
  fail_closed: true
  escalation_rule: stop
actions:
  - action: bad_entry
    default_mode: human_required
    requires_human_reason: null
    allowed_targets: []
    evidence_required: []
YAML

INVALID_OUTPUT_FILE="$TMPDIR/invalid-policy.out"

if bash "$SCRIPT" validate "$TMPDIR/invalid-policy.yml" >"$INVALID_OUTPUT_FILE" 2>/dev/null; then
  echo "FAIL: invalid policy should not validate" >&2
  exit 1
fi

printf '%s' "$(cat "$INVALID_OUTPUT_FILE")" | jq -e '.ok == false' >/dev/null
printf '%s' "$(cat "$INVALID_OUTPUT_FILE")" | jq -e '.errors | length > 0' >/dev/null

echo "check-autonomy-policy.sh tests passed"
