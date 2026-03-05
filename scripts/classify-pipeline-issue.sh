#!/usr/bin/env bash
set -euo pipefail

ISSUE_JSON=$(cat)

TITLE=$(printf '%s' "$ISSUE_JSON" | jq -r '.title // ""')
LABELS_JSON=$(printf '%s' "$ISSUE_JSON" | jq -c '[.labels[]?.name // empty | ascii_downcase]')

has_label() {
  local label="$1"
  printf '%s' "$LABELS_JSON" | jq -e --arg label "$label" 'index($label) != null' >/dev/null
}

REASON="actionable"
ACTIONABLE=true

if ! has_label "pipeline"; then
  ACTIONABLE=false
  REASON="missing_pipeline_label"
elif [ "$TITLE" = "[Pipeline] Status" ]; then
  ACTIONABLE=false
  REASON="status_issue"
elif [[ "$TITLE" == PRD:* ]]; then
  # Root PRD issues are planning/tracking items. repo-assist should work the
  # decomposed implementation issues, not loop on the PRD itself.
  ACTIONABLE=false
  REASON="prd_tracking_issue"
elif has_label "report"; then
  ACTIONABLE=false
  REASON="report_issue"
fi

jq -n \
  --arg title "$TITLE" \
  --arg reason "$REASON" \
  --argjson actionable "$ACTIONABLE" \
  --argjson labels "$LABELS_JSON" \
  '{
    actionable: $actionable,
    reason: $reason,
    title: $title,
    labels: $labels
  }'
