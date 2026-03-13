#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/classify-pipeline-pr.sh"

COPILOT_PR=$(cat <<'JSON'
{
  "title": "Refactor shared JSON loader",
  "headRefName": "copilot/refactor-json-loading-infrastructure",
  "baseRefName": "main",
  "author": {
    "login": "app/copilot-swe-agent"
  }
}
JSON
)

REPO_ASSIST_PR=$(cat <<'JSON'
{
  "title": "Fix navigation tests",
  "headRefName": "repo-assist/issue-361-fix-navigation-tests",
  "baseRefName": "main",
  "author": {
    "login": "samuelkahessay"
  }
}
JSON
)

TITLE_PR=$(cat <<'JSON'
{
  "title": "[Pipeline] Fix stale status banner",
  "headRefName": "fix/stale-status-banner",
  "baseRefName": "main",
  "author": {
    "login": "samuelkahessay"
  }
}
JSON
)

FEATURE_BRANCH_PR=$(cat <<'JSON'
{
  "title": "Fix repo-assist workflow",
  "headRefName": "copilot/sub-pr-285",
  "baseRefName": "feat/external-bug-intake",
  "author": {
    "login": "app/copilot-swe-agent"
  }
}
JSON
)

HUMAN_PR=$(cat <<'JSON'
{
  "title": "Clarify operator docs",
  "headRefName": "docs/clarify-autonomy",
  "baseRefName": "main",
  "author": {
    "login": "samuelkahessay"
  }
}
JSON
)

FRONTEND_AGENT_PR=$(cat <<'JSON'
{
  "title": "[Pipeline] Fix hero section overflow",
  "headRefName": "frontend-agent/issue-500-fix-hero-overflow",
  "baseRefName": "main",
  "author": {
    "login": "samuelkahessay"
  }
}
JSON
)

AGENTIC_BRANCHES=(
  "code-simplifier"
  "ci-doctor"
  "prd-decomposer"
  "duplicate-code-detector"
  "security-compliance"
  "pipeline-status"
  "prd-planner"
)

COPILOT_JSON=$(printf '%s' "$COPILOT_PR" | bash "$SCRIPT")
REPO_ASSIST_JSON=$(printf '%s' "$REPO_ASSIST_PR" | bash "$SCRIPT")
TITLE_JSON=$(printf '%s' "$TITLE_PR" | bash "$SCRIPT")
FEATURE_BRANCH_JSON=$(printf '%s' "$FEATURE_BRANCH_PR" | bash "$SCRIPT")
HUMAN_JSON=$(printf '%s' "$HUMAN_PR" | bash "$SCRIPT")

printf '%s' "$COPILOT_JSON" | jq -e '.pipeline_pr == true' >/dev/null
printf '%s' "$COPILOT_JSON" | jq -e '.reasons | index("copilot_branch") != null' >/dev/null
printf '%s' "$COPILOT_JSON" | jq -e '.reasons | index("copilot_author") != null' >/dev/null

printf '%s' "$REPO_ASSIST_JSON" | jq -e '.pipeline_pr == true' >/dev/null
printf '%s' "$REPO_ASSIST_JSON" | jq -e '.reason == "repo_assist_branch"' >/dev/null

printf '%s' "$TITLE_JSON" | jq -e '.pipeline_pr == true' >/dev/null
printf '%s' "$TITLE_JSON" | jq -e '.reason == "pipeline_title"' >/dev/null

printf '%s' "$FEATURE_BRANCH_JSON" | jq -e '.pipeline_pr == false' >/dev/null
printf '%s' "$FEATURE_BRANCH_JSON" | jq -e '.reason == "not_main_target"' >/dev/null

printf '%s' "$HUMAN_JSON" | jq -e '.pipeline_pr == false' >/dev/null
printf '%s' "$HUMAN_JSON" | jq -e '.reason == "no_pipeline_markers"' >/dev/null

FRONTEND_AGENT_JSON=$(printf '%s' "$FRONTEND_AGENT_PR" | bash "$SCRIPT")
printf '%s' "$FRONTEND_AGENT_JSON" | jq -e '.pipeline_pr == true' >/dev/null
printf '%s' "$FRONTEND_AGENT_JSON" | jq -e '.reason == "frontend_agent_branch"' >/dev/null
printf '%s' "$FRONTEND_AGENT_JSON" | jq -e '.reasons | index("frontend_agent_branch") != null' >/dev/null

for branch_prefix in "${AGENTIC_BRANCHES[@]}"; do
  AGENTIC_PR=$(cat <<JSON
{
  "title": "Tune workflow policy",
  "headRefName": "${branch_prefix}/fix-workflow-policy",
  "baseRefName": "main",
  "author": {
    "login": "samuelkahessay"
  }
}
JSON
)

  AGENTIC_JSON=$(printf '%s' "$AGENTIC_PR" | bash "$SCRIPT")
  if ! printf '%s' "$AGENTIC_JSON" | jq -e '.pipeline_pr == true' >/dev/null; then
    echo "Expected pipeline PR classification for ${branch_prefix}/" >&2
    exit 1
  fi

  if ! printf '%s' "$AGENTIC_JSON" | jq -e '.reason == "agentic_branch"' >/dev/null; then
    echo "Expected agentic_branch reason for ${branch_prefix}/" >&2
    exit 1
  fi

  if ! printf '%s' "$AGENTIC_JSON" | jq -e '.reasons | index("agentic_branch") != null' >/dev/null; then
    echo "Expected reasons to include agentic_branch for ${branch_prefix}/" >&2
    exit 1
  fi
done

echo "classify-pipeline-pr.sh tests passed"
