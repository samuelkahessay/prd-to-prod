#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: render-ci-repair-command.sh [options]

Options:
  --pr-number N
  --linked-issue N
  --head-sha SHA
  --head-branch BRANCH
  --failure-run-id ID
  --failure-run-url URL
  --failure-type TYPE
  --failure-signature SIGNATURE
  --attempt-count N
  --failure-summary TEXT
  --failure-excerpt TEXT
  --pr-diff TEXT
USAGE
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --pr-number) PR_NUMBER="$2"; shift 2 ;;
    --linked-issue) LINKED_ISSUE="$2"; shift 2 ;;
    --head-sha) HEAD_SHA="$2"; shift 2 ;;
    --head-branch) HEAD_BRANCH="$2"; shift 2 ;;
    --failure-run-id) FAILURE_RUN_ID="$2"; shift 2 ;;
    --failure-run-url) FAILURE_RUN_URL="$2"; shift 2 ;;
    --failure-type) FAILURE_TYPE="$2"; shift 2 ;;
    --failure-signature) FAILURE_SIGNATURE="$2"; shift 2 ;;
    --attempt-count) ATTEMPT_COUNT="$2"; shift 2 ;;
    --failure-summary) FAILURE_SUMMARY="$2"; shift 2 ;;
    --failure-excerpt) FAILURE_EXCERPT="$2"; shift 2 ;;
    --pr-diff) PR_DIFF="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

required_vars=(
  PR_NUMBER
  LINKED_ISSUE
  HEAD_SHA
  HEAD_BRANCH
  FAILURE_RUN_ID
  FAILURE_RUN_URL
  FAILURE_TYPE
  FAILURE_SIGNATURE
  ATTEMPT_COUNT
)

for required_var in "${required_vars[@]}"; do
  if [ -z "${!required_var:-}" ]; then
    echo "Missing required value: ${required_var}" >&2
    exit 1
  fi
done

FAILURE_SUMMARY=${FAILURE_SUMMARY:-Unknown failure}
FAILURE_EXCERPT=${FAILURE_EXCERPT:-$FAILURE_SUMMARY}
PR_DIFF=${PR_DIFF:-}

printf '%s\n' \
  "/repo-assist Repair CI failure for PR #${PR_NUMBER}." \
  "" \
  "<!-- ci-repair-command:v1" \
  "pr_number=${PR_NUMBER}" \
  "linked_issue=${LINKED_ISSUE}" \
  "head_sha=${HEAD_SHA}" \
  "head_branch=${HEAD_BRANCH}" \
  "failure_run_id=${FAILURE_RUN_ID}" \
  "failure_run_url=${FAILURE_RUN_URL}" \
  "failure_type=${FAILURE_TYPE}" \
  "failure_signature=${FAILURE_SIGNATURE}" \
  "attempt_count=${ATTEMPT_COUNT}" \
  "-->" \
  "" \
  "Fix the failure on the existing PR branch. Do not open a new PR. If the failure is stale because the PR head moved, comment that and stop." \
  "" \
  "### Failure Summary" \
  "${FAILURE_SUMMARY}" \
  "" \
  "### Failed-Step Excerpt" \
  '```text' \
  "${FAILURE_EXCERPT}" \
  '```'

if [ -n "$PR_DIFF" ]; then
  printf '%s\n' \
    "" \
    "### PR Diff" \
    '```diff' \
    "${PR_DIFF}" \
    '```'
fi
