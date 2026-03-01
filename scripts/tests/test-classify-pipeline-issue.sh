#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/classify-pipeline-issue.sh"

ACTIONABLE_ISSUE=$(cat <<'JSON'
{
  "title": "[Pipeline] Fix DrillCanary.cs CS1002",
  "labels": [
    { "name": "pipeline" },
    { "name": "bug" },
    { "name": "automation" }
  ]
}
JSON
)

STATUS_ISSUE=$(cat <<'JSON'
{
  "title": "[Pipeline] Status",
  "labels": [
    { "name": "pipeline" },
    { "name": "report" }
  ]
}
JSON
)

TRACKER_ISSUE=$(cat <<'JSON'
{
  "title": "PRD: Ticket Deflection Service (Run 04 - C#/.NET 8)",
  "labels": [
    { "name": "pipeline" }
  ]
}
JSON
)

ACTIONABLE_JSON=$(printf '%s' "$ACTIONABLE_ISSUE" | "$SCRIPT")
STATUS_JSON=$(printf '%s' "$STATUS_ISSUE" | "$SCRIPT")
TRACKER_JSON=$(printf '%s' "$TRACKER_ISSUE" | "$SCRIPT")

printf '%s' "$ACTIONABLE_JSON" | jq -e '.actionable == true' >/dev/null
printf '%s' "$ACTIONABLE_JSON" | jq -e '.reason == "actionable"' >/dev/null

printf '%s' "$STATUS_JSON" | jq -e '.actionable == false' >/dev/null
printf '%s' "$STATUS_JSON" | jq -e '.reason == "status_issue"' >/dev/null

printf '%s' "$TRACKER_JSON" | jq -e '.actionable == false' >/dev/null
printf '%s' "$TRACKER_JSON" | jq -e '.reason == "missing_actionable_label"' >/dev/null

echo "classify-pipeline-issue.sh tests passed"
