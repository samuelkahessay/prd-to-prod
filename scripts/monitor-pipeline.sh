#!/usr/bin/env bash
# Pipeline Observatory — Automated monitor
# Polls GitHub every INTERVAL seconds and prints status changes.
# Usage: ./scripts/monitor-pipeline.sh [interval_seconds]

set -euo pipefail

REPO="samuelkahessay/agentic-pipeline"
INTERVAL="${1:-180}"  # default 3 minutes
PREV_STATE=""
CYCLE=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

print_header() {
  echo ""
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Pipeline Monitor — Cycle $CYCLE — $(date '+%H:%M:%S')${NC}"
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
}

check_pipeline() {
  CYCLE=$((CYCLE + 1))
  print_header

  # Merged PRs (features shipped)
  MERGED=$(gh pr list --repo "$REPO" --state merged --json number,title \
    --jq '[.[] | select(.title | startswith("[Pipeline]"))] | length' 2>/dev/null || echo "?")

  # Open PRs with their review state
  OPEN_PRS=$(gh pr list --repo "$REPO" --state open --json number,title 2>/dev/null || echo "[]")
  OPEN_PR_COUNT=$(echo "$OPEN_PRS" | jq 'length')

  # Open pipeline issues
  OPEN_ISSUES=$(gh issue list --repo "$REPO" --state open --label pipeline --label feature \
    --json number --jq 'length' 2>/dev/null || echo "?")
  OPEN_INFRA=$(gh issue list --repo "$REPO" --state open --label pipeline --label infra \
    --json number --jq 'length' 2>/dev/null || echo "0")

  # Active runs
  ACTIVE_RUNS=$(gh run list --repo "$REPO" --limit 5 \
    --json databaseId,name,status,conclusion \
    --jq '[.[] | select(.status == "in_progress" or .status == "queued" or .status == "pending")] | length' 2>/dev/null || echo "?")

  TOTAL_OPEN=$((OPEN_ISSUES + OPEN_INFRA))

  # Summary line
  echo ""
  echo -e "  ${GREEN}Merged: $MERGED${NC}  |  ${YELLOW}Open PRs: $OPEN_PR_COUNT${NC}  |  ${RED}Open Issues: $TOTAL_OPEN${NC}  |  ${BLUE}Active Runs: $ACTIVE_RUNS${NC}"

  # Open PRs detail
  if [ "$OPEN_PR_COUNT" -gt 0 ]; then
    echo ""
    echo -e "  ${BOLD}Open PRs:${NC}"
    echo "$OPEN_PRS" | jq -r '.[] | "    #\(.number) \(.title)"'

    # Check review state for each open PR
    for PR_NUM in $(echo "$OPEN_PRS" | jq -r '.[].number'); do
      REVIEW_STATE=$(gh api "repos/$REPO/pulls/$PR_NUM/reviews" \
        --jq 'if length > 0 then .[-1].state else "PENDING" end' 2>/dev/null || echo "UNKNOWN")
      case "$REVIEW_STATE" in
        APPROVED) echo -e "      ${GREEN}-> APPROVED (auto-merge pending)${NC}" ;;
        CHANGES_REQUESTED) echo -e "      ${RED}-> CHANGES_REQUESTED (waiting for fixes)${NC}" ;;
        *) echo -e "      ${YELLOW}-> $REVIEW_STATE${NC}" ;;
      esac
    done
  fi

  # Active runs detail
  if [ "$ACTIVE_RUNS" -gt 0 ]; then
    echo ""
    echo -e "  ${BOLD}Active Runs:${NC}"
    gh run list --repo "$REPO" --limit 5 \
      --json databaseId,name,status,conclusion \
      --jq '.[] | select(.status == "in_progress" or .status == "queued" or .status == "pending") | "    \(.databaseId) \(.name) [\(.status)]"' 2>/dev/null
  fi

  # Build current state fingerprint for change detection
  CURRENT_STATE="merged=$MERGED;open_prs=$OPEN_PR_COUNT;issues=$TOTAL_OPEN;runs=$ACTIVE_RUNS"

  if [ "$CURRENT_STATE" != "$PREV_STATE" ] && [ -n "$PREV_STATE" ]; then
    echo ""
    echo -e "  ${PURPLE}*** STATE CHANGED ***${NC} (was: $PREV_STATE)"
  fi

  PREV_STATE="$CURRENT_STATE"

  # Completion check
  if [ "$TOTAL_OPEN" -eq 0 ] && [ "$OPEN_PR_COUNT" -eq 0 ]; then
    echo ""
    echo -e "  ${GREEN}${BOLD}PIPELINE COMPLETE — All features shipped!${NC}"
    echo -e "  ${GREEN}$MERGED pipeline PRs merged. No open issues or PRs remaining.${NC}"
    exit 0
  fi

  echo ""
  echo -e "  Next check in ${INTERVAL}s... (Ctrl+C to stop)"
}

echo -e "${CYAN}Starting pipeline monitor for $REPO${NC}"
echo -e "${CYAN}Polling every ${INTERVAL}s${NC}"

while true; do
  check_pipeline
  sleep "$INTERVAL"
done
