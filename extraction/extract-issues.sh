#!/usr/bin/env bash
set -euo pipefail

# extract-issues.sh — Extracts structured issues from a meeting transcript
# for filing into an existing product repo (v2 path).
#
# Input: stdin or file path
# Output: JSON array of normalized issue objects to stdout
# Requires: OPENROUTER_API_KEY, TARGET_REPO

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

normalize_issues() {
  local raw_input
  raw_input=$(cat)
  RAW_INPUT="$raw_input" python3 - <<'PY'
import json
import os
import sys

ALLOWED_TYPES = {"feature", "bug", "test", "infra", "docs"}

raw = os.environ.get("RAW_INPUT", "").strip()
if raw.startswith("```"):
    lines = raw.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    raw = "\n".join(lines).strip()

data = json.loads(raw)
if isinstance(data, dict):
    data = data.get("items") or data.get("issues") or [data]
if not isinstance(data, list):
    raise SystemExit("issue extraction must normalize to an array")

def normalize_type(item):
    raw_type = str(item.get("type") or "").strip().lower()
    labels = {str(label).strip().lower() for label in item.get("labels", []) if str(label).strip()}
    if raw_type in ALLOWED_TYPES:
        return raw_type
    for candidate in ("bug", "test", "infra", "docs", "feature"):
        if candidate in labels:
            return candidate
    if raw_type == "task":
        return "feature"
    return "feature"

def normalize_acceptance(item, description):
    acceptance = item.get("acceptance_criteria") or item.get("acceptanceCriteria") or []
    if isinstance(acceptance, str):
        acceptance = [acceptance]
    if not isinstance(acceptance, list):
        acceptance = []
    acceptance = [str(entry).strip() for entry in acceptance if str(entry).strip()]
    return acceptance or [f"Implement the requested change described here: {description}"]

def normalize_dependencies(item):
    dependencies = item.get("dependencies") or []
    if not isinstance(dependencies, list):
        return []
    normalized = []
    for dependency in dependencies:
        try:
            dep_int = int(dependency)
        except Exception:
            continue
        if dep_int >= 1:
            normalized.append(dep_int)
    return normalized

def normalize_technical_notes(item, acceptance):
    notes = item.get("technical_notes") or {}
    if not isinstance(notes, dict):
        notes = {}
    steps = notes.get("implementation_steps") or item.get("implementation_steps") or acceptance
    if isinstance(steps, str):
        steps = [steps]
    if not isinstance(steps, list):
        steps = acceptance
    steps = [str(step).strip() for step in steps if str(step).strip()]
    return {
        "current_state": str(notes.get("current_state") or "Repository state not yet analyzed."),
        "gap": str(notes.get("gap") or "Meeting-derived requirement needs to be implemented in the target repo."),
        "complexity": str(notes.get("complexity") or "Medium"),
        "estimated_effort": str(notes.get("estimated_effort") or "TBD"),
        "implementation_steps": steps[:8] or acceptance,
    }

normalized = []
for index, item in enumerate(data, start=1):
    if not isinstance(item, dict):
        raise SystemExit(f"item {index} is not an object")
    title = str(item.get("title") or item.get("summary") or f"Meeting follow-up {index}").strip()
    description = str(item.get("description") or item.get("body") or item.get("summary") or title).strip()
    acceptance = normalize_acceptance(item, description)
    normalized.append({
        "title": title,
        "description": description,
        "acceptance_criteria": acceptance,
        "type": normalize_type(item),
        "dependencies": normalize_dependencies(item),
        "technical_notes": normalize_technical_notes(item, acceptance),
    })

print(json.dumps(normalized, indent=2))
PY
}

fallback_issues() {
  python3 - <<'PY'
import json
import os

transcript = os.environ.get("TRANSCRIPT", "").strip()
title_words = transcript.split()
title = " ".join(title_words[:10]).strip() or "Meeting follow-up"
description = transcript[:600].strip() or "The transcript could not be structured automatically."
result = [{
    "title": title,
    "description": description,
    "acceptance_criteria": [
        "Review the meeting transcript and implement the requested change in the target repository.",
        "Document any assumptions made while reconstructing the work item from the transcript."
    ],
    "type": "feature",
    "dependencies": [],
    "technical_notes": {
        "current_state": "Structured extraction failed; no repo-specific analysis available.",
        "gap": "Manual review of the transcript is required to recover the intended issue shape.",
        "complexity": "Medium",
        "estimated_effort": "TBD",
        "implementation_steps": [
            "Review the transcript excerpt captured in the issue description.",
            "Translate the request into concrete code changes in the target repository."
        ]
    }
}]
print(json.dumps(result, indent=2))
PY
}

[ -n "${OPENROUTER_API_KEY:-}" ] || { echo "FAIL: OPENROUTER_API_KEY required" >&2; exit 1; }
[ -n "${TARGET_REPO:-}" ] || { echo "FAIL: TARGET_REPO required" >&2; exit 1; }

INPUT_FILE="${1:-}"
if [ -n "$INPUT_FILE" ] && [ -f "$INPUT_FILE" ]; then
  TRANSCRIPT=$(cat "$INPUT_FILE")
else
  TRANSCRIPT=$(cat)
fi

PROMPT="Extract actionable issues from this meeting transcript for the existing repo $TARGET_REPO.
Return JSON only. Use this exact array item shape:
{
  \"title\": \"short issue title\",
  \"description\": \"why this work matters and what needs to change\",
  \"acceptance_criteria\": [\"criterion 1\", \"criterion 2\"],
  \"type\": \"feature|bug|test|infra|docs\",
  \"dependencies\": [1],
  \"technical_notes\": {
    \"current_state\": \"what seems to exist now\",
    \"gap\": \"what is missing\",
    \"complexity\": \"Low|Medium|High\",
    \"estimated_effort\": \"short estimate\",
    \"implementation_steps\": [\"step 1\", \"step 2\"]
  }
}
Use dependencies only when an item must land after another item in this same response; refer to earlier items by 1-based index.
Prefer feature or bug unless the transcript is explicitly about docs, tests, or infrastructure.

Transcript:
$TRANSCRIPT"

API_RESPONSE=$(call_openrouter "$PROMPT")
ISSUES=$(printf '%s' "$API_RESPONSE" | extract_content)
NORMALIZED_ISSUES=$(printf '%s' "$ISSUES" | normalize_issues)

if ! printf '%s' "$NORMALIZED_ISSUES" | bash "$SCRIPT_DIR/validate-schema.sh" "issues-output.json" - 2>/dev/null; then
  echo "WARN: Issue extraction output failed schema validation — retrying once" >&2
  API_RESPONSE=$(call_openrouter "$PROMPT")
  ISSUES=$(printf '%s' "$API_RESPONSE" | extract_content)
  NORMALIZED_ISSUES=$(printf '%s' "$ISSUES" | normalize_issues 2>/dev/null || true)
fi

if ! printf '%s' "$NORMALIZED_ISSUES" | bash "$SCRIPT_DIR/validate-schema.sh" "issues-output.json" - 2>/dev/null; then
  echo "WARN: Issue extraction output remained invalid — falling back to a deterministic placeholder issue" >&2
  NORMALIZED_ISSUES=$(TRANSCRIPT="$TRANSCRIPT" fallback_issues)
fi

printf '%s' "$NORMALIZED_ISSUES" | bash "$SCRIPT_DIR/validate-schema.sh" "issues-output.json" - >/dev/null
printf '%s\n' "$NORMALIZED_ISSUES"
