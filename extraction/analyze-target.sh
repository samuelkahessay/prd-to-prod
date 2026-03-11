#!/usr/bin/env bash
set -euo pipefail

# analyze-target.sh — Enriches extracted requirements with target-repo gap analysis.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

call_openrouter() {
  local prompt="$1"
  local escaped_prompt

  escaped_prompt=$(printf '%s' "$prompt" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  curl -s https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"anthropic/claude-sonnet-4-6\",
      \"messages\": [{\"role\": \"user\", \"content\": $escaped_prompt}]
    }"
}

extract_content() {
  python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["choices"][0]["message"]["content"])'
}

decode_file_content() {
  python3 -c 'import base64,json,sys; data=json.loads(sys.stdin.read()); print(base64.b64decode(data["content"]).decode())'
}

build_enriched_output() {
  python3 - "$1" "$2" <<'PY'
from pathlib import Path
import json
import sys

requirements = json.loads(Path(sys.argv[1]).read_text())
gap_results = json.loads(Path(sys.argv[2]).read_text())

enriched = []
for idx, requirement in enumerate(requirements):
    item = dict(requirement)
    item["gapAnalysis"] = gap_results[idx]
    enriched.append(item)

print(json.dumps(enriched, indent=2))
PY
}

fallback_gap() {
  python3 - <<'PY'
import json
import os

requirement = os.environ.get("REQUIREMENT_TEXT", "Requirement")
print(json.dumps({
    "requirement": requirement,
    "currentState": "Analysis failed",
    "gap": "Unable to analyze the target repository automatically.",
    "suggestedAction": "Review the repository manually and implement the requirement.",
    "affectedFiles": [],
    "severity": "major"
}))
PY
}

REQUIREMENTS_FILE="${1:-}"
[ -n "$REQUIREMENTS_FILE" ] || fail "Usage: analyze-target.sh <requirements-json-file>"
[ -f "$REQUIREMENTS_FILE" ] || fail "Requirements file not found: $REQUIREMENTS_FILE"
[ -n "${TARGET_REPO:-}" ] || fail "TARGET_REPO required"
[ -n "${OPENROUTER_API_KEY:-}" ] || fail "OPENROUTER_API_KEY required"

TARGET_REF="${TARGET_REF:-}"
if [ -z "$TARGET_REF" ]; then
  TARGET_REF=$(gh api "repos/$TARGET_REPO" --jq '.default_branch')
fi

TREE_JSON=$(gh api "repos/$TARGET_REPO/git/trees/$TARGET_REF?recursive=1")
TREE_PATHS=$(printf '%s' "$TREE_JSON" | jq '[.tree[] | select(.type == "blob") | .path]')

TMPDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

GAP_RESULTS_FILE="$TMPDIR/gap-results.jsonl"
: > "$GAP_RESULTS_FILE"

REQUIREMENT_COUNT=$(jq 'length' "$REQUIREMENTS_FILE")
for idx in $(seq 0 $((REQUIREMENT_COUNT - 1))); do
  requirement_text=$(jq -r ".[$idx].acceptance_criteria[0] // .[$idx].description // .[$idx].title" "$REQUIREMENTS_FILE")

  stage1_prompt=$(cat <<EOF
Select the most relevant source files for this requirement from the target repo.
Requirement: $requirement_text

Repo tree:
$TREE_PATHS

Return JSON only in this shape:
{"files":[{"path":"src/file.ts","reason":"why it matters"}]}
EOF
)

  stage1_content=$(call_openrouter "$stage1_prompt" | extract_content)
  if ! printf '%s' "$stage1_content" | bash "$SCRIPT_DIR/validate-schema.sh" "$SCRIPT_DIR/schemas/file-selector-output.json" - >/dev/null 2>&1; then
    REQUIREMENT_TEXT="$requirement_text" fallback_gap >> "$GAP_RESULTS_FILE"
    echo >> "$GAP_RESULTS_FILE"
    continue
  fi

  selected_paths=$(printf '%s' "$stage1_content" | jq -r '.files[].path')
  file_bundle=""
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    file_json=$(gh api "repos/$TARGET_REPO/contents/$path?ref=$TARGET_REF")
    decoded=$(printf '%s' "$file_json" | decode_file_content)
    file_bundle="${file_bundle}\nFILE: ${path}\n${decoded}\n"
  done <<< "$selected_paths"

  stage2_prompt=$(cat <<EOF
Analyze the target repository for this requirement.
Requirement: $requirement_text

Selected files:
$file_bundle

Return JSON only in this shape:
{"requirement":"...","currentState":"...","gap":"...","suggestedAction":"...","affectedFiles":["src/file.ts"],"severity":"major"}
EOF
)

  stage2_content=$(call_openrouter "$stage2_prompt" | extract_content)
  if printf '%s' "$stage2_content" | bash "$SCRIPT_DIR/validate-schema.sh" "$SCRIPT_DIR/schemas/gap-item.json" - >/dev/null 2>&1; then
    printf '%s\n' "$stage2_content" >> "$GAP_RESULTS_FILE"
  else
    REQUIREMENT_TEXT="$requirement_text" fallback_gap >> "$GAP_RESULTS_FILE"
    echo >> "$GAP_RESULTS_FILE"
  fi
done

python3 - "$GAP_RESULTS_FILE" "$TMPDIR/gap-results.json" <<'PY'
from pathlib import Path
import json
import sys

items = []
for line in Path(sys.argv[1]).read_text().splitlines():
    line = line.strip()
    if not line:
        continue
    items.append(json.loads(line))
Path(sys.argv[2]).write_text(json.dumps(items))
PY

build_enriched_output "$REQUIREMENTS_FILE" "$TMPDIR/gap-results.json"
