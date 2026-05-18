#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)

usage() {
  cat >&2 <<'USAGE'
Usage: scripts/verify-repo-protection.sh [--repo owner/name]

Verifies the repository-level controls expected by prd-to-prod:
- CODEOWNERS is present
- auto-merge is enabled
- squash merge is allowed
- delete branch on merge is enabled
- an active Protect main branch ruleset exists
- the ruleset requires at least one approving review
- the ruleset requires the review status check
- the ruleset does not grant direct bypass actors

For tests, set REPO_PROTECTION_FIXTURE to a JSON file with:
{
  "repository": {...},
  "rulesets": [{...}]
}
USAGE
  exit 2
}

REPO=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      [ "$#" -ge 2 ] || usage
      REPO="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      usage
      ;;
  esac
done

failures=()

require() {
  local ok="$1"
  local message="$2"
  if [ "$ok" != "true" ]; then
    failures+=("$message")
  fi
}

if [ ! -f "$ROOT_DIR/.github/CODEOWNERS" ]; then
  failures+=(".github/CODEOWNERS is missing")
fi

if [ -n "${REPO_PROTECTION_FIXTURE:-}" ]; then
  [ -f "$REPO_PROTECTION_FIXTURE" ] || { echo "Fixture not found: $REPO_PROTECTION_FIXTURE" >&2; exit 2; }
  REPO_JSON=$(jq -c '.repository' "$REPO_PROTECTION_FIXTURE")
  RULESETS_JSON=$(jq -c '.rulesets' "$REPO_PROTECTION_FIXTURE")
else
  command -v gh >/dev/null 2>&1 || { echo "gh CLI is required" >&2; exit 2; }
  command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 2; }

  if [ -z "$REPO" ]; then
    REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
  fi

  REPO_JSON=$(gh api "repos/$REPO" --jq '{full_name,allow_auto_merge,allow_squash_merge,delete_branch_on_merge,default_branch,visibility}')
  RULESET_LIST=$(gh api "repos/$REPO/rulesets")
  RULESETS_JSON=$(printf '%s' "$RULESET_LIST" | jq -c '[.[] | select(.target == "branch" and .enforcement == "active" and .name == "Protect main")]')

  # The list endpoint can omit rule details. Hydrate each matching ruleset by id.
  if [ "$(printf '%s' "$RULESETS_JSON" | jq 'length')" -gt 0 ]; then
    RULESETS_JSON=$(printf '%s' "$RULESETS_JSON" | jq -r '.[].id' | while IFS= read -r id; do
      gh api "repos/$REPO/rulesets/$id"
    done | jq -s -c '.')
  fi
fi

require "$(printf '%s' "$REPO_JSON" | jq -r '.allow_auto_merge == true')" "Repository must have auto-merge enabled"
require "$(printf '%s' "$REPO_JSON" | jq -r '.allow_squash_merge == true')" "Repository must allow squash merge"
require "$(printf '%s' "$REPO_JSON" | jq -r '.delete_branch_on_merge == true')" "Repository must delete branches on merge"

PROTECT_MAIN=$(printf '%s' "$RULESETS_JSON" | jq -c '[.[] | select(.name == "Protect main" and .target == "branch" and .enforcement == "active")] | first // null')
if [ "$PROTECT_MAIN" = "null" ]; then
  failures+=("Active branch ruleset named Protect main is missing")
else
  HAS_REVIEW_RULE=$(printf '%s' "$PROTECT_MAIN" | jq -r '
    [.rules[]? | select(.type == "pull_request")
      | (.parameters.required_approving_review_count // .parameters.requiredApprovingReviewCount // 0)
      | tonumber
      | select(. >= 1)] | length > 0
  ')
  require "$HAS_REVIEW_RULE" "Protect main must require at least one approving review"

  HAS_REVIEW_STATUS=$(printf '%s' "$PROTECT_MAIN" | jq -r '
    [.rules[]? | select(.type == "required_status_checks")
      | .parameters.required_status_checks[]?
      | (.context // .name // "")
      | select(. == "review")] | length > 0
  ')
  require "$HAS_REVIEW_STATUS" "Protect main must require the review status check"

  HAS_NO_BYPASS_ACTORS=$(printf '%s' "$PROTECT_MAIN" | jq -r '(.bypass_actors // []) | length == 0')
  require "$HAS_NO_BYPASS_ACTORS" "Protect main must not grant direct bypass actors"
fi

if [ "${#failures[@]}" -gt 0 ]; then
  echo "FAIL: repo protection verification failed" >&2
  for failure in "${failures[@]}"; do
    echo " - $failure" >&2
  done
  exit 1
fi

echo "Repo protection verification passed"
