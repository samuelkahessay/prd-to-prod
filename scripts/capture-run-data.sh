#!/usr/bin/env bash
#
# capture-run-data.sh — Harvests GitHub API data for a pipeline run and writes
# a structured JSON file for the landing page visualization.
#
# Usage:
#   ./scripts/capture-run-data.sh <run-number>
#
# Expects:
#   - gh CLI authenticated
#   - showcase/<run-dir>/manifest.json with run metadata and issue/PR lists
#
# Output:
#   - showcase/<run-dir>/run-data.json
#

set -euo pipefail

REPO="samuelkahessay/prd-to-prod"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <run-number>"
  echo "Example: $0 1"
  exit 1
fi

RUN_NUMBER=$1

# Find the showcase directory for this run
RUN_DIR=$(find showcase -maxdepth 1 -type d -name "$(printf '%02d' "$RUN_NUMBER")-*" | head -1)
if [ -z "$RUN_DIR" ]; then
  echo "Error: No showcase directory found for run ${RUN_NUMBER}"
  echo "Expected: showcase/$(printf '%02d' "$RUN_NUMBER")-*/"
  exit 1
fi

MANIFEST="${RUN_DIR}/manifest.json"
OUTPUT="${RUN_DIR}/run-data.json"

if [ ! -f "$MANIFEST" ]; then
  echo "Error: No manifest.json found at ${MANIFEST}"
  echo "Create one with run metadata, issue numbers, and PR numbers."
  exit 1
fi

echo "Capturing run data for Run ${RUN_NUMBER} from ${RUN_DIR}..."

# Read manifest
RUN_META=$(jq -c '.run' "$MANIFEST")
ISSUE_NUMBERS=$(jq -r '.issues[]' "$MANIFEST" 2>/dev/null || true)
PR_NUMBERS=$(jq -r '.pull_requests[]' "$MANIFEST" 2>/dev/null || true)

# Fetch issues
echo "Fetching issues..."
ISSUES="[]"
for NUM in $ISSUE_NUMBERS; do
  echo "  Issue #${NUM}"
  ISSUE_JSON=$(gh api "repos/${REPO}/issues/${NUM}" --jq '{
    number: .number,
    title: .title,
    body: .body,
    state: .state,
    labels: [.labels[].name],
    created_at: .created_at,
    closed_at: .closed_at,
    user: .user.login
  }' 2>/dev/null || echo "{\"number\": ${NUM}, \"error\": \"not found\"}")
  ISSUES=$(printf '%s' "$ISSUES" | jq --argjson item "$ISSUE_JSON" '. + [$item]')
  sleep 0.2  # Rate limit courtesy
done

# Fetch PRs with reviews and file stats
echo "Fetching pull requests..."
PRS="[]"
for NUM in $PR_NUMBERS; do
  echo "  PR #${NUM}"

  # PR metadata
  PR_JSON=$(gh api "repos/${REPO}/pulls/${NUM}" --jq '{
    number: .number,
    title: .title,
    body: .body,
    state: .state,
    merged_at: .merged_at,
    created_at: .created_at,
    additions: .additions,
    deletions: .deletions,
    changed_files: .changed_files,
    user: .user.login,
    head_branch: .head.ref,
    base_branch: .base.ref
  }' 2>/dev/null || echo "{\"number\": ${NUM}, \"error\": \"not found\"}")

  # Reviews
  REVIEWS=$(gh api "repos/${REPO}/pulls/${NUM}/reviews" --jq '[.[] | {
    user: .user.login,
    state: .state,
    body: (.body // "" | .[0:500]),
    submitted_at: .submitted_at
  }]' 2>/dev/null || echo '[]')

  # Changed files
  FILES=$(gh api "repos/${REPO}/pulls/${NUM}/files" --jq '[.[] | {
    filename: .filename,
    status: .status,
    additions: .additions,
    deletions: .deletions
  }]' 2>/dev/null || echo '[]')

  # Combine
  COMBINED=$(printf '%s' "$PR_JSON" | jq \
    --argjson reviews "$REVIEWS" \
    --argjson files "$FILES" \
    '. + {reviews: $reviews, files: $files}')

  PRS=$(printf '%s' "$PRS" | jq --argjson item "$COMBINED" '. + [$item]')
  sleep 0.3  # Rate limit courtesy
done

# Build timeline from issues and PRs
echo "Building timeline..."
TIMELINE="[]"

# Issue creation events
for ROW in $(printf '%s' "$ISSUES" | jq -c '.[]'); do
  NUM=$(printf '%s' "$ROW" | jq -r '.number')
  TITLE=$(printf '%s' "$ROW" | jq -r '.title')
  CREATED=$(printf '%s' "$ROW" | jq -r '.created_at')
  if [ "$CREATED" != "null" ] && [ -n "$CREATED" ]; then
    EVENT=$(jq -n --arg ts "$CREATED" --arg title "$TITLE" --argjson num "$NUM" \
      '{timestamp: $ts, event: "issue_created", item: $num, title: $title}')
    TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
  fi
done

# PR creation, review, and merge events
for ROW in $(printf '%s' "$PRS" | jq -c '.[]'); do
  NUM=$(printf '%s' "$ROW" | jq -r '.number')
  TITLE=$(printf '%s' "$ROW" | jq -r '.title')
  CREATED=$(printf '%s' "$ROW" | jq -r '.created_at')
  MERGED=$(printf '%s' "$ROW" | jq -r '.merged_at')

  if [ "$CREATED" != "null" ] && [ -n "$CREATED" ]; then
    EVENT=$(jq -n --arg ts "$CREATED" --arg title "$TITLE" --argjson num "$NUM" \
      '{timestamp: $ts, event: "pr_opened", item: $num, title: $title}')
    TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
  fi

  # Review events
  for REVIEW in $(printf '%s' "$ROW" | jq -c '.reviews[]? // empty'); do
    REVIEW_TS=$(printf '%s' "$REVIEW" | jq -r '.submitted_at')
    REVIEW_STATE=$(printf '%s' "$REVIEW" | jq -r '.state')
    if [ "$REVIEW_TS" != "null" ] && [ -n "$REVIEW_TS" ]; then
      EVENT=$(jq -n --arg ts "$REVIEW_TS" --arg state "$REVIEW_STATE" --argjson num "$NUM" --arg title "$TITLE" \
        '{timestamp: $ts, event: ("review_" + ($state | ascii_downcase)), item: $num, title: $title}')
      TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
    fi
  done

  if [ "$MERGED" != "null" ] && [ -n "$MERGED" ]; then
    EVENT=$(jq -n --arg ts "$MERGED" --arg title "$TITLE" --argjson num "$NUM" \
      '{timestamp: $ts, event: "pr_merged", item: $num, title: $title}')
    TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
  fi
done

# Sort timeline by timestamp
TIMELINE=$(printf '%s' "$TIMELINE" | jq 'sort_by(.timestamp)')

# Compute stats
ISSUES_COUNT=$(printf '%s' "$ISSUES" | jq 'length')
PRS_COUNT=$(printf '%s' "$PRS" | jq 'length')
PRS_MERGED=$(printf '%s' "$PRS" | jq '[.[] | select(.merged_at != null)] | length')
TOTAL_ADDITIONS=$(printf '%s' "$PRS" | jq '[.[].additions // 0] | add // 0')
TOTAL_DELETIONS=$(printf '%s' "$PRS" | jq '[.[].deletions // 0] | add // 0')
TOTAL_FILES=$(printf '%s' "$PRS" | jq '[.[].changed_files // 0] | add // 0')

STATS=$(jq -n \
  --argjson issues "$ISSUES_COUNT" \
  --argjson prs "$PRS_COUNT" \
  --argjson merged "$PRS_MERGED" \
  --argjson additions "$TOTAL_ADDITIONS" \
  --argjson deletions "$TOTAL_DELETIONS" \
  --argjson files "$TOTAL_FILES" \
  '{
    issues_created: $issues,
    prs_total: $prs,
    prs_merged: $merged,
    lines_added: $additions,
    lines_removed: $deletions,
    files_changed: $files
  }')

# Assemble final output
echo "Writing ${OUTPUT}..."
jq -n \
  --argjson run "$RUN_META" \
  --argjson stats "$STATS" \
  --argjson issues "$ISSUES" \
  --argjson prs "$PRS" \
  --argjson timeline "$TIMELINE" \
  '{
    run: $run,
    stats: $stats,
    issues: $issues,
    pull_requests: $prs,
    timeline: $timeline
  }' > "$OUTPUT"

echo "Done. Captured $(printf '%s' "$ISSUES" | jq 'length') issues, $(printf '%s' "$PRS" | jq 'length') PRs, $(printf '%s' "$TIMELINE" | jq 'length') timeline events."
echo "Output: ${OUTPUT}"
