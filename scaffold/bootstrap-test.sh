#!/usr/bin/env bash
set -euo pipefail

# bootstrap-test.sh — Smoke-tests the exported scaffold.
#
# Validates: critical files, config integrity, workflow script references, and
# that compiled workflow lock files are reproducible from the exported sources.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/dist/scaffold"

[ -d "$OUTPUT_DIR" ] || { echo "FAIL: run export-scaffold.sh first" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "FAIL: gh is required" >&2; exit 1; }
gh aw --help >/dev/null 2>&1 || { echo "FAIL: gh-aw extension is required" >&2; exit 1; }
# shellcheck disable=SC1091
source "$OUTPUT_DIR/scripts/require-node.sh"

ERRORS=0

report_failure() {
  echo "FAIL: $1"
  ((ERRORS+=1))
}

normalize_lock_file() {
  python3 - "$1" <<'PY'
from pathlib import Path
import re
import sys

content = Path(sys.argv[1]).read_text()
content = re.sub(r'"stop_time":"[^"]+"', '"stop_time":"<normalized>"', content)
content = re.sub(r'(# Effective stop-time: ).*', r'\1<normalized>', content)
content = re.sub(r'(GH_AW_STOP_TIME: ).*', r'\1<normalized>', content)
print(content, end="")
PY
}

CRITICAL_FILES=(
  ".github/workflows/auto-dispatch.yml"
  ".github/workflows/repo-assist.md"
  ".github/workflows/repo-assist.lock.yml"
  ".github/workflows/pr-review-agent.md"
  ".github/workflows/pr-review-agent.lock.yml"
  ".github/workflows/prd-decomposer.md"
  ".github/workflows/prd-decomposer.lock.yml"
  ".github/workflows/deploy-router.yml"
  ".deploy-profile"
  "AGENTS.md"
  "README.md"
  "scripts/bootstrap.sh"
)

for file in "${CRITICAL_FILES[@]}"; do
  [ -f "$OUTPUT_DIR/$file" ] || report_failure "critical file missing from scaffold: $file"
done

PROFILE=$(tr -d '[:space:]' < "$OUTPUT_DIR/.deploy-profile" 2>/dev/null || true)
[ -n "$PROFILE" ] || report_failure ".deploy-profile is empty"
[ -f "$OUTPUT_DIR/.github/deploy-profiles/$PROFILE.yml" ] || report_failure "deploy profile '$PROFILE' is missing from scaffold"

if [ "$PROFILE" = "nextjs-vercel" ]; then
  if ! APP_ROOT=$(bash "$OUTPUT_DIR/scripts/resolve-nextjs-app-root.sh" "$OUTPUT_DIR" 2>/dev/null); then
    report_failure "nextjs-vercel scaffold could not resolve an app root"
  elif [ "$APP_ROOT" != "web" ] && [ "$APP_ROOT" != "." ]; then
    report_failure "nextjs-vercel scaffold resolved unexpected app root: $APP_ROOT"
  fi

  if [ ! -d "$OUTPUT_DIR/console" ] && \
    grep -F 'working-directory: console' "$OUTPUT_DIR/.github/workflows/ci-node.yml" >/dev/null && \
    ! grep -F "hashFiles('console/package.json')" "$OUTPUT_DIR/.github/workflows/ci-node.yml" >/dev/null; then
    report_failure "ci-node.yml assumes console/ exists even when scaffold omits it"
  fi
fi

if [ -f "$OUTPUT_DIR/autonomy-policy.yml" ] && grep -q "# Replace with your" "$OUTPUT_DIR/autonomy-policy.yml"; then
  report_failure "autonomy-policy.yml still contains placeholder guidance"
fi

SCRIPT_REFERENCES=$(grep -RhoE 'scripts/[A-Za-z0-9._/-]+\.sh' "$OUTPUT_DIR/.github/workflows" 2>/dev/null | sort -u || true)
while IFS= read -r ref; do
  [ -n "$ref" ] || continue
  [ -f "$OUTPUT_DIR/$ref" ] || report_failure "workflow references missing scaffold script: $ref"
done <<< "$SCRIPT_REFERENCES"

# ── Build validation: prove the exported scaffold follows the shared validator ──
if [ "$PROFILE" = "nextjs-vercel" ]; then
  if ! bash "$OUTPUT_DIR/scripts/validate-implementation.sh"; then
    report_failure "scripts/validate-implementation.sh failed in exported scaffold"
  fi
  if [ -n "${APP_ROOT:-}" ]; then
    APP_DIR="$OUTPUT_DIR/$APP_ROOT"
    rm -rf "$APP_DIR/node_modules" "$APP_DIR/.next"
  fi
  if [ -d "$OUTPUT_DIR/console" ]; then
    rm -rf "$OUTPUT_DIR/console/node_modules"
  fi
fi

TMP_REPO="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_REPO"
}
trap cleanup EXIT

cp -R "$OUTPUT_DIR/." "$TMP_REPO/"
(cd "$TMP_REPO" && git init -q >/dev/null 2>&1)

ORIGINAL_LOCKS=$(cd "$OUTPUT_DIR" && find .github/workflows -name "*.lock.yml" -type f | sort)
[ -n "$ORIGINAL_LOCKS" ] || report_failure "no compiled .lock.yml workflows found in scaffold"

while IFS= read -r lock_file; do
  [ -n "$lock_file" ] || continue
  cp "$TMP_REPO/$lock_file" "$TMP_REPO/$lock_file.original"
  rm -f "$TMP_REPO/$lock_file"
done <<< "$ORIGINAL_LOCKS"

if ! (
  cd "$TMP_REPO"
  if ! gh aw compile >/dev/null 2>&1; then
    :
  fi
  gh aw compile >/dev/null 2>&1
  bash scripts/patch-codex-openrouter-http-locks.sh >/dev/null 2>&1 || true
  bash scripts/patch-runner-labels.sh .github/workflows >/dev/null 2>&1 || true
  bash scripts/patch-pr-review-agent-lock.sh .github/workflows/pr-review-agent.lock.yml >/dev/null 2>&1 || true
); then
  report_failure "gh aw compile failed during bootstrap recompile check"
fi

SOURCE_WORKFLOWS=$(cd "$TMP_REPO" && find .github/workflows -maxdepth 1 -name "*.md" -type f | sort)
while IFS= read -r source_workflow; do
  [ -n "$source_workflow" ] || continue
  lock_file="${source_workflow%.md}.lock.yml"
  [ -f "$TMP_REPO/$lock_file" ] || report_failure "missing compiled lock file after recompile: $lock_file"
done <<< "$SOURCE_WORKFLOWS"

while IFS= read -r lock_file; do
  [ -n "$lock_file" ] || continue
  [ -f "$TMP_REPO/$lock_file" ] || continue
  if ! diff -u <(normalize_lock_file "$TMP_REPO/$lock_file.original") <(normalize_lock_file "$TMP_REPO/$lock_file") >/dev/null; then
    report_failure "stale exported lock file differs from recompilation: $lock_file"
  fi
done <<< "$ORIGINAL_LOCKS"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: bootstrap-test found $ERRORS error(s)"
  exit 1
fi

echo "Bootstrap test passed: scaffold structure valid"
