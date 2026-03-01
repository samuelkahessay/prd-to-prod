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
  exit 1
fi

MANIFEST="${RUN_DIR}/manifest.json"
OUTPUT="${RUN_DIR}/run-data.json"

if [ ! -f "$MANIFEST" ]; then
  echo "Error: No manifest.json found at ${MANIFEST}"
  exit 1
fi

# Create temp directory for intermediate files
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Capturing run data for Run ${RUN_NUMBER} from ${RUN_DIR}..."

# Read manifest
ISSUE_NUMBERS=$(jq -r '.issues[]' "$MANIFEST" 2>/dev/null || true)
PR_NUMBERS=$(jq -r '.pull_requests[]' "$MANIFEST" 2>/dev/null || true)

# Fetch issues into temp file
echo "Fetching issues..."
echo '[]' > "$TMPDIR/issues.json"
for NUM in $ISSUE_NUMBERS; do
  echo "  Issue #${NUM}"
  gh api "repos/${REPO}/issues/${NUM}" > "$TMPDIR/issue_raw.json" 2>/dev/null || echo '{}' > "$TMPDIR/issue_raw.json"
  jq '{
    number: .number,
    title: .title,
    body: .body,
    state: .state,
    labels: [.labels[]?.name],
    created_at: .created_at,
    closed_at: .closed_at,
    user: .user.login
  }' "$TMPDIR/issue_raw.json" > "$TMPDIR/issue_clean.json" 2>/dev/null || echo "{\"number\": ${NUM}, \"error\": \"parse failed\"}" > "$TMPDIR/issue_clean.json"
  jq --slurpfile item "$TMPDIR/issue_clean.json" '. + $item' "$TMPDIR/issues.json" > "$TMPDIR/issues_new.json"
  mv "$TMPDIR/issues_new.json" "$TMPDIR/issues.json"
  sleep 0.2
done

# Fetch PRs with reviews and file stats into temp file
echo "Fetching pull requests..."
echo '[]' > "$TMPDIR/prs.json"
for NUM in $PR_NUMBERS; do
  echo "  PR #${NUM}"

  # PR metadata
  gh api "repos/${REPO}/pulls/${NUM}" > "$TMPDIR/pr_raw.json" 2>/dev/null || echo '{}' > "$TMPDIR/pr_raw.json"
  jq '{
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
  }' "$TMPDIR/pr_raw.json" > "$TMPDIR/pr_clean.json" 2>/dev/null || echo "{\"number\": ${NUM}, \"error\": \"parse failed\"}" > "$TMPDIR/pr_clean.json"

  # Reviews
  gh api "repos/${REPO}/pulls/${NUM}/reviews" > "$TMPDIR/reviews_raw.json" 2>/dev/null || echo '[]' > "$TMPDIR/reviews_raw.json"
  jq '[.[] | {
    user: .user.login,
    state: .state,
    body: ((.body // "")[0:500]),
    submitted_at: .submitted_at
  }]' "$TMPDIR/reviews_raw.json" > "$TMPDIR/reviews_clean.json" 2>/dev/null || echo '[]' > "$TMPDIR/reviews_clean.json"

  # Changed files
  gh api "repos/${REPO}/pulls/${NUM}/files" > "$TMPDIR/files_raw.json" 2>/dev/null || echo '[]' > "$TMPDIR/files_raw.json"
  jq '[.[] | {
    filename: .filename,
    status: .status,
    additions: .additions,
    deletions: .deletions
  }]' "$TMPDIR/files_raw.json" > "$TMPDIR/files_clean.json" 2>/dev/null || echo '[]' > "$TMPDIR/files_clean.json"

  # Combine PR + reviews + files
  jq --slurpfile reviews "$TMPDIR/reviews_clean.json" --slurpfile files "$TMPDIR/files_clean.json" \
    '. + {reviews: $reviews[0], files: $files[0]}' "$TMPDIR/pr_clean.json" > "$TMPDIR/pr_combined.json"

  # Append to PRs array
  jq --slurpfile item "$TMPDIR/pr_combined.json" '. + $item' "$TMPDIR/prs.json" > "$TMPDIR/prs_new.json"
  mv "$TMPDIR/prs_new.json" "$TMPDIR/prs.json"
  sleep 0.3
done

# Build timeline entirely in jq (no bash iteration over JSON)
echo "Building timeline..."
jq -n \
  --slurpfile issues "$TMPDIR/issues.json" \
  --slurpfile prs "$TMPDIR/prs.json" \
  '
  [
    # Issue creation events
    ($issues[0][] | select(.created_at != null) | {
      timestamp: .created_at,
      event: "issue_created",
      item: .number,
      title: .title
    }),
    # PR opened events
    ($prs[0][] | select(.created_at != null) | {
      timestamp: .created_at,
      event: "pr_opened",
      item: .number,
      title: .title
    }),
    # PR review events
    ($prs[0][] | . as $pr | .reviews[]? | select(.submitted_at != null) | {
      timestamp: .submitted_at,
      event: ("review_" + (.state | ascii_downcase)),
      item: $pr.number,
      title: $pr.title
    }),
    # PR merged events
    ($prs[0][] | select(.merged_at != null) | {
      timestamp: .merged_at,
      event: "pr_merged",
      item: .number,
      title: .title
    })
  ] | sort_by(.timestamp)
  ' > "$TMPDIR/timeline.json"

# Compute stats
echo "Computing stats..."
jq -n \
  --slurpfile issues "$TMPDIR/issues.json" \
  --slurpfile prs "$TMPDIR/prs.json" \
  '{
    issues_created: ($issues[0] | length),
    prs_total: ($prs[0] | length),
    prs_merged: ([$prs[0][] | select(.merged_at != null)] | length),
    lines_added: ([$prs[0][].additions // 0] | add // 0),
    lines_removed: ([$prs[0][].deletions // 0] | add // 0),
    files_changed: ([$prs[0][].changed_files // 0] | add // 0)
  }' > "$TMPDIR/stats.json"

# Assemble final output
echo "Writing ${OUTPUT}..."
jq -n \
  --slurpfile run <(jq '.run' "$MANIFEST") \
  --slurpfile stats "$TMPDIR/stats.json" \
  --slurpfile issues "$TMPDIR/issues.json" \
  --slurpfile prs "$TMPDIR/prs.json" \
  --slurpfile timeline "$TMPDIR/timeline.json" \
  '{
    run: $run[0],
    stats: $stats[0],
    issues: $issues[0],
    pull_requests: $prs[0],
    timeline: $timeline[0]
  }' > "$OUTPUT"

ISSUE_COUNT=$(jq '.issues | length' "$OUTPUT")
PR_COUNT=$(jq '.pull_requests | length' "$OUTPUT")
TIMELINE_COUNT=$(jq '.timeline | length' "$OUTPUT")
echo "Done. Captured ${ISSUE_COUNT} issues, ${PR_COUNT} PRs, ${TIMELINE_COUNT} timeline events."
echo "Output: ${OUTPUT}"
