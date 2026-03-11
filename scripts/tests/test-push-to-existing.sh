#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/trigger/push-to-existing.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

CALL_LOG="$TMPDIR/call.log"
STATE_FILE="$TMPDIR/state.json"
export CALL_LOG STATE_FILE
printf '{"next_issue_number":100,"issues":[]}' > "$STATE_FILE"

cat > "$TMPDIR/issues.json" <<'JSON'
[
  {
    "title": "Prepare existing repo plumbing",
    "description": "Add the routing and setup needed for existing-product work.",
    "acceptance_criteria": [
      "Create the shared plumbing in the target repository.",
      "Document the new entrypoint for existing-product mode."
    ],
    "type": "infra",
    "dependencies": [],
    "technical_notes": {
      "current_state": "The existing repository has no v2 ingress path.",
      "gap": "Pipeline issue creation is missing for existing-product meetings.",
      "complexity": "Medium",
      "estimated_effort": "1 day",
      "implementation_steps": [
        "Add the shared routing surface.",
        "Update the operator-facing documentation."
      ]
    }
  },
  {
    "title": "Ship the existing repo issue",
    "description": "Create the actual feature issue once routing exists.",
    "acceptance_criteria": [
      "The child issue body matches the v1 downstream contract."
    ],
    "type": "feature",
    "dependencies": [1],
    "technical_notes": {
      "current_state": "The pipeline creates no existing-product issues.",
      "gap": "Need a child issue with downstream-compatible sections.",
      "complexity": "Low",
      "estimated_effort": "half day",
      "implementation_steps": [
        "Create the issue after the infra item exists."
      ]
    }
  }
]
JSON

mkdir -p "$TMPDIR/bin"
cat > "$TMPDIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
echo "gh $*" >> "$CALL_LOG"

update_state() {
  python3 - "$STATE_FILE" "$@" <<'PY'
from pathlib import Path
import json
import sys

state_path = Path(sys.argv[1])
state = json.loads(state_path.read_text())
cmd = sys.argv[2]

if cmd == "create":
    title = sys.argv[3]
    labels = sys.argv[4].split(",") if sys.argv[4] else []
    body = Path(sys.argv[5]).read_text()
    number = state["next_issue_number"]
    state["next_issue_number"] += 1
    state["issues"].append({"number": number, "title": title, "labels": labels, "body": body})
    state_path.write_text(json.dumps(state))
    print(number)
elif cmd == "edit":
    number = int(sys.argv[3])
    body = Path(sys.argv[4]).read_text()
    for issue in state["issues"]:
        if issue["number"] == number:
            issue["body"] = body
            break
    state_path.write_text(json.dumps(state))
elif cmd == "list":
    labels = [label for label in sys.argv[3].split(",") if label]
    issues = state["issues"]
    if labels:
        wanted = set(labels)
        issues = [issue for issue in issues if wanted.issubset(set(issue["labels"]))]
    print(json.dumps([
        {
            "number": issue["number"],
            "title": issue["title"],
            "body": issue["body"],
            "url": f"https://github.com/test/repo/issues/{issue['number']}"
        }
        for issue in issues
    ]))
PY
}

case "$1" in
  issue)
    case "$2" in
      list)
        labels=""
        shift 2
        while [ "$#" -gt 0 ]; do
          case "$1" in
            --label)
              labels="${labels:+$labels,}$2"
              shift 2
              ;;
            *)
              shift
              ;;
          esac
        done
        update_state list "$labels"
        ;;
      create)
        title=""
        body_file=""
        labels=""
        shift 2
        while [ "$#" -gt 0 ]; do
          case "$1" in
            --title) title="$2"; shift 2 ;;
            --body-file) body_file="$2"; shift 2 ;;
            --label) labels="${labels:+$labels,}$2"; shift 2 ;;
            *) shift ;;
          esac
        done
        number=$(update_state create "$title" "$labels" "$body_file")
        echo "https://github.com/test/repo/issues/$number"
        ;;
      edit)
        issue_number="$3"
        shift 3
        body_file=""
        while [ "$#" -gt 0 ]; do
          case "$1" in
            --body-file) body_file="$2"; shift 2 ;;
            *) shift ;;
          esac
        done
        update_state edit "$issue_number" "$body_file"
        ;;
    esac
    ;;
  api)
    if printf '%s' "$*" | grep -q "/sub_issues"; then
      exit 0
    fi
    if printf '%s' "$*" | grep -q "repos/test/repo/issues/"; then
      issue_number=$(printf '%s' "$*" | sed -n 's#.*repos/test/repo/issues/\([0-9][0-9]*\).*#\1#p')
      printf '{"node_id":"NODE_%s"}\n' "$issue_number"
      exit 0
    fi
    ;;
esac
exit 0
STUB
chmod +x "$TMPDIR/bin/gh"

ln -sf "$(command -v jq)" "$TMPDIR/bin/jq"
export PATH="$TMPDIR/bin:$PATH"
export TARGET_REPO="test/repo"
export PIPELINE_TRANSCRIPT_HASH="abc123hash"
export PIPELINE_MEETING_SOURCE="sync-notes.txt"
export PIPELINE_MEETING_DATE="2026-03-11"
export PIPELINE_MEETING_TITLE="Operator sync"

if ! bash "$SCRIPT" "$TMPDIR/issues.json" >"$TMPDIR/stdout.log" 2>"$TMPDIR/stderr.log"; then
  echo "FAIL: push-to-existing.sh failed" >&2
  cat "$TMPDIR/stderr.log" >&2
  exit 1
fi

STATE_JSON=$(cat "$STATE_FILE")
EPIC_NUMBER=$(printf '%s' "$STATE_JSON" | jq -r '.issues[] | select(.title | startswith("[Pipeline] Meeting:")) | .number')
FIRST_NUMBER=$(printf '%s' "$STATE_JSON" | jq -r '.issues[] | select(.title == "[Pipeline] Prepare existing repo plumbing") | .number')
SECOND_NUMBER=$(printf '%s' "$STATE_JSON" | jq -r '.issues[] | select(.title == "[Pipeline] Ship the existing repo issue") | .number')

[ -n "$EPIC_NUMBER" ] || { echo "FAIL: tracking epic was not created" >&2; exit 1; }
[ -n "$FIRST_NUMBER" ] || { echo "FAIL: first child issue was not created" >&2; exit 1; }
[ -n "$SECOND_NUMBER" ] || { echo "FAIL: second child issue was not created" >&2; exit 1; }
echo "Test 1 passed: tracking epic and child issues created"

FIRST_BODY=$(printf '%s' "$STATE_JSON" | jq -r --arg num "$FIRST_NUMBER" '.issues[] | select((.number|tostring) == $num) | .body')
SECOND_BODY=$(printf '%s' "$STATE_JSON" | jq -r --arg num "$SECOND_NUMBER" '.issues[] | select((.number|tostring) == $num) | .body')

printf '%s' "$FIRST_BODY" | grep -q "## PRD Traceability" || { echo "FAIL: first issue missing PRD Traceability section" >&2; exit 1; }
printf '%s' "$FIRST_BODY" | grep -q "<!-- meeting-to-main:transcript-hash:abc123hash -->" || { echo "FAIL: first issue missing transcript hash marker" >&2; exit 1; }
printf '%s' "$SECOND_BODY" | grep -q "Depends on #$FIRST_NUMBER" || { echo "FAIL: second issue missing resolved dependency" >&2; exit 1; }
printf '%s' "$SECOND_BODY" | grep -q "## Technical Notes" || { echo "FAIL: second issue missing Technical Notes section" >&2; exit 1; }
echo "Test 2 passed: child issues use downstream-compatible body sections"

printf '%s' "$STATE_JSON" | jq -e --arg num "$FIRST_NUMBER" '.issues[] | select((.number|tostring) == $num) | .labels | index("infra")' >/dev/null || {
  echo "FAIL: first child issue missing infra label" >&2
  exit 1
}
printf '%s' "$STATE_JSON" | jq -e --arg num "$SECOND_NUMBER" '.issues[] | select((.number|tostring) == $num) | .labels | index("feature")' >/dev/null || {
  echo "FAIL: second child issue missing feature label" >&2
  exit 1
}
echo "Test 3 passed: canonical labels applied"

grep -q "/sub_issues" "$CALL_LOG" || {
  echo "FAIL: expected sub-issue linking API call" >&2
  exit 1
}
echo "Test 4 passed: sub-issue linking attempted"

grep -q "PIPELINE_TRACKING_ISSUE_NUMBER=$EPIC_NUMBER" "$TMPDIR/stdout.log" || {
  echo "FAIL: missing machine-readable tracking issue export" >&2
  exit 1
}
echo "Test 5 passed: machine-readable outputs emitted"

echo "push-to-existing tests passed"
