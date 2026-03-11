#!/usr/bin/env bash
set -euo pipefail

# push-to-existing.sh — Creates downstream-compatible [Pipeline] issues in TARGET_REPO
# from structured issue JSON.

log() { echo "[prd-to-prod] $*"; }
warn() { echo "[prd-to-prod] WARN: $*" >&2; }
fail() { echo "[prd-to-prod] ERROR: $*" >&2; exit 1; }

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

TARGET_REPO="${TARGET_REPO:-}"
[ -n "$TARGET_REPO" ] || fail "TARGET_REPO required"
if ! printf '%s' "$TARGET_REPO" | grep -qE '^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$'; then
  fail "TARGET_REPO must be in owner/repo format, got: $TARGET_REPO"
fi

INPUT_FILE="${1:-}"
if [ -n "$INPUT_FILE" ] && [ -f "$INPUT_FILE" ]; then
  ISSUES_JSON=$(cat "$INPUT_FILE")
else
  ISSUES_JSON=$(cat)
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

printf '%s' "$ISSUES_JSON" | jq empty 2>/dev/null || fail "Invalid JSON input"
printf '%s' "$ISSUES_JSON" | bash "$SCRIPT_DIR/../extraction/validate-schema.sh" "issues-output.json" - >/dev/null

ISSUE_COUNT=$(printf '%s' "$ISSUES_JSON" | jq 'length')
[ "$ISSUE_COUNT" -gt 0 ] || fail "No issues to create"

TRANSCRIPT_HASH="${PIPELINE_TRANSCRIPT_HASH:-}"
if [ -z "$TRANSCRIPT_HASH" ]; then
  TRANSCRIPT_HASH="$(sha256_of_string "$ISSUES_JSON")"
fi

PIPELINE_MEETING_SOURCE="${PIPELINE_MEETING_SOURCE:-Meeting transcript}"
PIPELINE_MEETING_DATE="${PIPELINE_MEETING_DATE:-$(date -u +%F)}"
PIPELINE_MEETING_TITLE="${PIPELINE_MEETING_TITLE:-Existing Product Work}"

TMPDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

ISSUES_FILE="$TMPDIR/issues.json"
printf '%s\n' "$ISSUES_JSON" > "$ISSUES_FILE"

render_epic_body() {
  local output_file="$1"
  python3 - "$output_file" <<'PY'
from pathlib import Path
import os
import sys

body = f"""## PRD Traceability
- **Source:** {os.environ['PIPELINE_MEETING_SOURCE']} ({os.environ['PIPELINE_MEETING_DATE']})
- **Mode:** Existing product routing

## Description
Tracks child issues created from a meeting transcript routed into an existing repository.

<!-- meeting-to-main:transcript-hash:{os.environ['TRANSCRIPT_HASH']} -->
"""

Path(sys.argv[1]).write_text(body)
PY
}

render_issue_body() {
  local item_index="$1"
  local output_file="$2"
  python3 - "$ISSUES_FILE" "$item_index" "$output_file" <<'PY'
from pathlib import Path
import json
import os
import sys

issues = json.loads(Path(sys.argv[1]).read_text())
item_index = int(sys.argv[2])
output_path = Path(sys.argv[3])
item = issues[item_index - 1]
issue_map = json.loads(os.environ.get("ISSUE_NUMBER_MAP_JSON", "{}"))

dependency_parts = []
for dep in item.get("dependencies", []):
    dep_number = issue_map.get(str(dep))
    if dep_number:
        dependency_parts.append(f"Depends on #{dep_number}")
    else:
        dependency_parts.append(f"Depends on item {dep} (unresolved)")
dependency_text = ", ".join(dependency_parts) if dependency_parts else "None"

technical = item.get("technical_notes", {})
current_state = technical.get("current_state") or "Repository state not yet analyzed."
gap = technical.get("gap") or "Meeting-derived requirement needs implementation."
complexity = technical.get("complexity") or "Medium"
estimated_effort = technical.get("estimated_effort") or "TBD"
steps = technical.get("implementation_steps") or item.get("acceptance_criteria") or ["Implement the requested change."]
steps = [str(step).strip() for step in steps if str(step).strip()]
acceptance = [str(entry).strip() for entry in item.get("acceptance_criteria", []) if str(entry).strip()]

body_lines = [
    "## PRD Traceability",
    f"- **Source:** {os.environ['PIPELINE_MEETING_SOURCE']} ({os.environ['PIPELINE_MEETING_DATE']})",
    "- **Source Sections:** Meeting transcript synthesis",
    "- **Normative Requirements In Scope:**",
    f"  - {item['title']}",
    "",
    "## Description",
    item["description"].strip(),
    "",
    "## Acceptance Criteria",
]
body_lines.extend([f"- [ ] {criterion}" for criterion in acceptance])
body_lines.extend([
    "",
    "## Dependencies",
    dependency_text,
    "",
    "## Technical Notes",
    "",
    "### Current State",
    current_state,
    "",
    "### Gap",
    gap,
    "",
    "### Complexity",
    f"{complexity} - Estimated effort: {estimated_effort}",
    "",
    "### Implementation Steps",
])
body_lines.extend([f"{idx}. {step}" for idx, step in enumerate(steps, start=1)])
body_lines.extend([
    "",
    f"<!-- meeting-to-main:transcript-hash:{os.environ['TRANSCRIPT_HASH']} -->",
    f"<!-- meeting-to-main:item-index:{item_index} -->",
])

output_path.write_text("\n".join(body_lines) + "\n")
PY
}

extract_issue_number() {
  printf '%s' "$1" | sed -E 's#.*/issues/([0-9]+)$#\1#'
}

find_existing_issue_number() {
  local item_index="$1"
  printf '%s' "$EXISTING_PIPELINE_ISSUES" | jq -r \
    --arg hash "$TRANSCRIPT_HASH" \
    --arg index "$item_index" '
      .[] |
      select((.body // "") | contains("meeting-to-main:transcript-hash:\($hash)")) |
      select((.body // "") | contains("meeting-to-main:item-index:\($index)")) |
      .number
    ' | head -1
}

find_epic_number() {
  printf '%s' "$EXISTING_PRD_ISSUES" | jq -r \
    --arg hash "$TRANSCRIPT_HASH" '
      .[] |
      select((.body // "") | contains("meeting-to-main:transcript-hash:\($hash)")) |
      .number
    ' | head -1
}

create_issue() {
  local title="$1"
  local body_file="$2"
  shift 2
  gh issue create --repo "$TARGET_REPO" --title "$title" --body-file "$body_file" "$@"
}

link_sub_issue() {
  local epic_number="$1"
  local child_number="$2"
  local child_node_id

  child_node_id=$(gh api "repos/$TARGET_REPO/issues/$child_number" --jq '.node_id' 2>/dev/null || true)
  [ -n "$child_node_id" ] || return 0
  gh api "repos/$TARGET_REPO/issues/$epic_number/sub_issues" --method POST -f "sub_issue_id=$child_node_id" >/dev/null 2>&1 || \
    warn "Unable to link #$child_number as a sub-issue of #$epic_number"
}

EXISTING_PIPELINE_ISSUES=$(gh issue list --repo "$TARGET_REPO" --label pipeline --state open --limit 200 --json number,title,body,url 2>/dev/null || echo "[]")
EXISTING_PRD_ISSUES=$(gh issue list --repo "$TARGET_REPO" --label pipeline --label prd --state open --limit 200 --json number,title,body,url 2>/dev/null || echo "[]")

EPIC_NUMBER="$(find_epic_number)"
if [ -z "$EPIC_NUMBER" ]; then
  EPIC_BODY_FILE="$TMPDIR/epic-body.md"
  TRANSCRIPT_HASH="$TRANSCRIPT_HASH" PIPELINE_MEETING_SOURCE="$PIPELINE_MEETING_SOURCE" PIPELINE_MEETING_DATE="$PIPELINE_MEETING_DATE" render_epic_body "$EPIC_BODY_FILE"
  EPIC_URL=$(create_issue "[Pipeline] Meeting: $PIPELINE_MEETING_TITLE ($PIPELINE_MEETING_DATE)" "$EPIC_BODY_FILE" --label pipeline --label prd)
  EPIC_NUMBER="$(extract_issue_number "$EPIC_URL")"
  log "Created tracking epic #$EPIC_NUMBER: $EPIC_URL"
else
  log "Reusing tracking epic #$EPIC_NUMBER"
fi

declare -a ISSUE_NUMBERS=()
CREATED=0
SKIPPED=0

for item_index in $(seq 1 "$ISSUE_COUNT"); do
  existing_number="$(find_existing_issue_number "$item_index")"
  if [ -n "$existing_number" ]; then
    ISSUE_NUMBERS+=("$existing_number")
    log "Reusing existing issue #$existing_number for item $item_index"
    ((SKIPPED+=1))
    continue
  fi

  title=$(jq -r ".[$((item_index - 1))].title" "$ISSUES_FILE")
  type=$(jq -r ".[$((item_index - 1))].type" "$ISSUES_FILE")
  placeholder_file="$TMPDIR/item-$item_index.placeholder.md"
  printf 'Issue body will be populated after dependency resolution.\n\n<!-- meeting-to-main:transcript-hash:%s -->\n<!-- meeting-to-main:item-index:%s -->\n' "$TRANSCRIPT_HASH" "$item_index" > "$placeholder_file"
  issue_url=$(create_issue "[Pipeline] $title" "$placeholder_file" --label pipeline --label "$type")
  issue_number="$(extract_issue_number "$issue_url")"
  ISSUE_NUMBERS+=("$issue_number")
  log "Created #$issue_number for item $item_index: $issue_url"
  ((CREATED+=1))
done

ISSUE_NUMBER_MAP_JSON="$(python3 - "${ISSUE_NUMBERS[@]}" <<'PY'
import json
import sys

mapping = {str(index): value for index, value in enumerate(sys.argv[1:], start=1)}
print(json.dumps(mapping))
PY
)"

for item_index in $(seq 1 "$ISSUE_COUNT"); do
  issue_number="${ISSUE_NUMBERS[$((item_index - 1))]}"
  body_file="$TMPDIR/item-$item_index.body.md"
  ISSUE_NUMBER_MAP_JSON="$ISSUE_NUMBER_MAP_JSON" \
  TRANSCRIPT_HASH="$TRANSCRIPT_HASH" \
  PIPELINE_MEETING_SOURCE="$PIPELINE_MEETING_SOURCE" \
  PIPELINE_MEETING_DATE="$PIPELINE_MEETING_DATE" \
  render_issue_body "$item_index" "$body_file"
  gh issue edit "$issue_number" --repo "$TARGET_REPO" --body-file "$body_file" >/dev/null
  link_sub_issue "$EPIC_NUMBER" "$issue_number"
done

log "Created $CREATED issue(s), skipped $SKIPPED duplicate(s)"
echo "PIPELINE_TRACKING_ISSUE_NUMBER=$EPIC_NUMBER"
echo "PIPELINE_TARGET_REPO=$TARGET_REPO"
echo "PIPELINE_ISSUES_CREATED=$CREATED"
