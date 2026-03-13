#!/usr/bin/env bash
set -euo pipefail

PR_JSON=$(cat)

TITLE=$(printf '%s' "$PR_JSON" | jq -r '.title // ""')
HEAD_REF_NAME=$(printf '%s' "$PR_JSON" | jq -r '.headRefName // ""')
BASE_REF_NAME=$(printf '%s' "$PR_JSON" | jq -r '.baseRefName // ""')
AUTHOR_LOGIN=$(printf '%s' "$PR_JSON" | jq -r '.author.login // ""')

REASONS=$(jq -cn \
  --arg title "$TITLE" \
  --arg head_ref_name "$HEAD_REF_NAME" \
  --arg author_login "$AUTHOR_LOGIN" \
  '[
    if ($head_ref_name | startswith("repo-assist/")) then "repo_assist_branch" else empty end,
    if ($head_ref_name | startswith("frontend-agent/")) then "frontend_agent_branch" else empty end,
    if ($head_ref_name | startswith("copilot/")) then "copilot_branch" else empty end,
    if ($head_ref_name | startswith("code-simplifier/")) then "agentic_branch" else empty end,
    if ($head_ref_name | startswith("ci-doctor/")) then "agentic_branch" else empty end,
    if ($head_ref_name | startswith("prd-decomposer/")) then "agentic_branch" else empty end,
    if ($head_ref_name | startswith("duplicate-code-detector/")) then "agentic_branch" else empty end,
    if ($head_ref_name | startswith("security-compliance/")) then "agentic_branch" else empty end,
    if ($head_ref_name | startswith("pipeline-status/")) then "agentic_branch" else empty end,
    if ($head_ref_name | startswith("prd-planner/")) then "agentic_branch" else empty end,
    if ($title | startswith("[Pipeline]")) then "pipeline_title" else empty end,
    if $author_login == "app/copilot-swe-agent" then "copilot_author" else empty end
  ]')

PIPELINE_PR=false
REASON="no_pipeline_markers"

if [ "$BASE_REF_NAME" != "main" ]; then
  REASON="not_main_target"
elif printf '%s' "$REASONS" | jq -e 'length > 0' >/dev/null; then
  PIPELINE_PR=true
  REASON=$(printf '%s' "$REASONS" | jq -r '.[0]')
fi

jq -n \
  --arg title "$TITLE" \
  --arg headRefName "$HEAD_REF_NAME" \
  --arg baseRefName "$BASE_REF_NAME" \
  --arg authorLogin "$AUTHOR_LOGIN" \
  --arg reason "$REASON" \
  --argjson pipeline_pr "$PIPELINE_PR" \
  --argjson reasons "$REASONS" \
  '{
    pipeline_pr: $pipeline_pr,
    reason: $reason,
    reasons: $reasons,
    title: $title,
    headRefName: $headRefName,
    baseRefName: $baseRefName,
    authorLogin: $authorLogin
  }'
