#!/usr/bin/env bash
# =============================================================================
# Self-Healing Drill Harness
# =============================================================================
# Validates the autonomous self-healing pipeline end-to-end by injecting a
# deliberate build failure and observing the pipeline's response through
# GitHub API polling.
#
# Usage:
#   ./scripts/self-healing-drill.sh run main_build_syntax
#   ./scripts/self-healing-drill.sh audit <commit-sha>
#
# Modes:
#   run   — inject fault, poll GitHub API for each stage, produce JSON report
#   audit — retroactively analyze a past drill from API data
#
# Exit codes: 0=PASS, 1=FAIL, 2=injection/preflight error
# =============================================================================
set -uo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REPO="samuelkahessay/prd-to-prod"
CANARY_FILE="$REPO_ROOT/TicketDeflection/Canary/DrillCanary.cs"
REPORT_DIR="$REPO_ROOT/drills/reports"
POLL_INTERVAL=15
OVERALL_TIMEOUT_S=2700  # 45 minutes

# SLAs (seconds)
SLA_FAILURE_TO_ISSUE=120
SLA_ISSUE_TO_DISPATCH=120
SLA_DISPATCH_TO_PR=600
SLA_PR_TO_GREEN=900
SLA_GREEN_TO_MERGE=600
SLA_MERGE_TO_RECOVERY=300

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Cross-platform date helpers (macOS vs Linux)
# ---------------------------------------------------------------------------
iso_to_epoch() {
  local iso="$1"
  # Strip trailing Z for macOS compatibility, use -u for UTC
  local cleaned="${iso%Z}"
  if date -juf "%Y-%m-%dT%H:%M:%S" "$cleaned" +%s 2>/dev/null; then
    return
  fi
  # Linux fallback
  date -d "$iso" +%s 2>/dev/null || echo "0"
}

now_epoch() {
  date +%s
}

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ---------------------------------------------------------------------------
# Layer 1: Core — JSON report management
# ---------------------------------------------------------------------------
REPORT_FILE=""
DRILL_ID=""
DRILL_START_EPOCH=""
SOURCE_DRILL_ID=""

init_report() {
  local drill_type="$1"
  local injected_commit="${2:-}"

  if [ -z "$DRILL_ID" ]; then
    DRILL_ID="$(date -u +%Y%m%d-%H%M%S)"
  fi
  DRILL_START_EPOCH="$(now_epoch)"
  REPORT_FILE="${REPORT_DIR}/${DRILL_ID}.json"

  mkdir -p "$REPORT_DIR"

  jq -n \
    --arg drill_id "$DRILL_ID" \
    --arg drill_type "$drill_type" \
    --arg injected_commit "$injected_commit" \
    --arg source_drill_id "$SOURCE_DRILL_ID" \
    --arg failure_signature "" \
    --arg dispatch_workflow "" \
    --arg started_at "$(now_iso)" \
    --arg verdict "pending" \
    '{
      drill_id: $drill_id,
      drill_type: $drill_type,
      injected_commit: $injected_commit,
      source_drill_id: $source_drill_id,
      failure_signature: $failure_signature,
      dispatch_workflow: $dispatch_workflow,
      started_at: $started_at,
      verdict: $verdict,
      stages: {}
    }' > "$REPORT_FILE"
}

update_stage() {
  local stage_name="$1"
  local stage_json="$2"

  local tmp
  tmp=$(mktemp)
  jq --arg name "$stage_name" --argjson data "$stage_json" \
    '.stages[$name] = $data' "$REPORT_FILE" > "$tmp" && mv "$tmp" "$REPORT_FILE"
}

update_top_level() {
  local key="$1" value="$2"
  local tmp
  tmp=$(mktemp)
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    jq --arg k "$key" --argjson v "$value" '.[$k] = $v' "$REPORT_FILE" > "$tmp" && mv "$tmp" "$REPORT_FILE"
  elif [[ "$value" == "true" || "$value" == "false" ]]; then
    jq --arg k "$key" --argjson v "$value" '.[$k] = $v' "$REPORT_FILE" > "$tmp" && mv "$tmp" "$REPORT_FILE"
  else
    jq --arg k "$key" --arg v "$value" '.[$k] = $v' "$REPORT_FILE" > "$tmp" && mv "$tmp" "$REPORT_FILE"
  fi
}

read_marker_field() {
  local body="$1"
  local field="$2"
  printf '%s\n' "$body" | sed -n "s/^${field}=//p" | head -1
}

find_marker_comment() {
  local item_number="$1"
  local marker="$2"
  local comments_json
  comments_json=$(gh api "repos/${REPO}/issues/${item_number}/comments?per_page=100" 2>/dev/null || echo "[]")
  printf '%s' "$comments_json" | jq -c --arg marker "$marker" '[.[] | select(.body | contains($marker))] | last // {}'
}

extract_drill_id_for_commit() {
  local commit="$1"
  local commit_message
  commit_message=$(gh api "repos/${REPO}/commits/${commit}" --jq '.commit.message' 2>/dev/null || echo "")
  printf '%s\n' "$commit_message" | sed -n 's/.*\[drill-id:\([^]]*\)\].*/\1/p' | head -1
}

# ---------------------------------------------------------------------------
# Layer 1: Core — Display
# ---------------------------------------------------------------------------
log_stage() {
  local stage="$1"
  local status="$2"
  local detail="${3:-}"

  local color="$NC"
  case "$status" in
    pass) color="$GREEN" ;;
    fail|timeout) color="$RED" ;;
    searching|waiting) color="$YELLOW" ;;
    info) color="$CYAN" ;;
  esac

  echo -e "${BOLD}[${stage}]${NC} ${color}${status}${NC} ${detail}"
}

print_summary() {
  echo ""
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Drill Report: ${DRILL_ID}${NC}"
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"

  local verdict
  verdict=$(jq -r '.verdict' "$REPORT_FILE")

  local verdict_color="$RED"
  case "$verdict" in
    PASS) verdict_color="$GREEN" ;;
    PASS_WITH_MANUAL_RESUME|UNPROVABLE) verdict_color="$YELLOW" ;;
  esac

  echo -e "  Verdict: ${verdict_color}${BOLD}${verdict}${NC}"
  local verdict_reason
  verdict_reason=$(jq -r '.verdict_reason // ""' "$REPORT_FILE")
  if [ -n "$verdict_reason" ]; then
    echo "  Reason: $verdict_reason"
  fi
  echo ""

  # Print each stage
  local stages
  stages=$(jq -r '.stages | keys[]' "$REPORT_FILE" 2>/dev/null || true)
  for stage in $stages; do
    local st url elapsed sla
    st=$(jq -r ".stages[\"$stage\"].status" "$REPORT_FILE")
    url=$(jq -r ".stages[\"$stage\"].url // \"-\"" "$REPORT_FILE")
    elapsed=$(jq -r ".stages[\"$stage\"].elapsed_from_previous_s // \"-\"" "$REPORT_FILE")
    sla=$(jq -r ".stages[\"$stage\"].sla_s // \"-\"" "$REPORT_FILE")

    local sc="$RED"
    if [ "$st" = "pass" ]; then sc="$GREEN"; fi

    echo -e "  ${BOLD}${stage}${NC}: ${sc}${st}${NC}  (elapsed: ${elapsed}s / SLA: ${sla}s)"
    if [ -n "$url" ] && [ "$url" != "-" ] && [ "$url" != "null" ]; then
      echo "    URL: $url"
    fi
  done

  echo ""
  echo "  Report: $REPORT_FILE"
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
}

# ---------------------------------------------------------------------------
# Layer 1: Core — Verdict logic
# ---------------------------------------------------------------------------
compute_verdict() {
  local fail_reasons=""
  local blocking_failure=false
  local stage

  for stage in ci_failure issue_created repair_pr ci_green auto_merge main_recovered; do
    local st
    st=$(jq -r ".stages[\"$stage\"].status // \"missing\"" "$REPORT_FILE")
    if [ "$st" != "pass" ]; then
      blocking_failure=true
      fail_reasons="${fail_reasons:+${fail_reasons}, }${stage}=${st}"
    fi
  done

  local auto_dispatch_status
  auto_dispatch_status=$(jq -r '.stages.auto_dispatch.status // "missing"' "$REPORT_FILE")
  local dispatch_workflow
  dispatch_workflow=$(jq -r '.dispatch_workflow // ""' "$REPORT_FILE")
  local auto_merge_armed
  auto_merge_armed=$(jq -r '.stages.auto_merge.auto_merge_armed_observed // "false"' "$REPORT_FILE")

  if $blocking_failure; then
    update_top_level "verdict" "FAIL"
    if [ -n "$fail_reasons" ]; then
      update_top_level "verdict_reason" "$fail_reasons"
    fi
  elif [ "$auto_dispatch_status" != "pass" ] || [ "$dispatch_workflow" != "Auto-Dispatch Pipeline Issues" ]; then
    update_top_level "verdict" "PASS_WITH_MANUAL_RESUME"
    update_top_level "verdict_reason" "Dispatch required manual resume or non-standard path (${dispatch_workflow:-unknown})"
  elif [ "$auto_merge_armed" != "true" ]; then
    update_top_level "verdict" "UNPROVABLE"
    update_top_level "verdict_reason" "PR merged and main recovered, but durable auto-merge evidence was not observed"
  else
    update_top_level "verdict" "PASS"
  fi

  update_top_level "completed_at" "$(now_iso)"
}

# ---------------------------------------------------------------------------
# Layer 2: Finders — GitHub API queries (shared by run and audit)
# ---------------------------------------------------------------------------

# find_ci_failure(commit) — find failing Deploy to Azure or .NET CI run
# Sets: CI_FAIL_RUN_ID, CI_FAIL_RUN_URL, CI_FAIL_TIMESTAMP, CI_FAIL_STATUS
find_ci_failure() {
  local commit="$1"
  CI_FAIL_RUN_ID=""
  CI_FAIL_RUN_URL=""
  CI_FAIL_TIMESTAMP=""
  CI_FAIL_STATUS="not_found"

  # Look for failing runs on this commit (Deploy to Azure or .NET CI)
  local runs_json
  runs_json=$(gh api "repos/${REPO}/actions/runs?head_sha=${commit}&per_page=50" \
    --jq '.workflow_runs' 2>/dev/null || echo "[]")

  # Prefer "Deploy to Azure" failure, fall back to ".NET CI"
  local run
  run=$(echo "$runs_json" | jq -r '
    [.[] | select(.conclusion == "failure" and (.name == "Deploy to Azure" or .name == ".NET CI"))]
    | sort_by(if .name == "Deploy to Azure" then 0 else 1 end)
    | first // empty' 2>/dev/null || true)

  if [ -n "$run" ] && [ "$run" != "null" ]; then
    CI_FAIL_RUN_ID=$(echo "$run" | jq -r '.id')
    CI_FAIL_RUN_URL=$(echo "$run" | jq -r '.html_url')
    CI_FAIL_TIMESTAMP=$(echo "$run" | jq -r '.created_at')
    CI_FAIL_STATUS="pass"
  fi
}

# find_issue(commit, run_id, run_url) — find [Pipeline] CI Build Failure issue
# that references the commit SHA or run URL in its body.
# Sets: ISSUE_NUMBER, ISSUE_URL, ISSUE_TIMESTAMP, ISSUE_STATUS
find_issue() {
  local commit="$1"
  local run_id="$2"
  local run_url="$3"
  ISSUE_NUMBER=""
  ISSUE_URL=""
  ISSUE_TIMESTAMP=""
  ISSUE_STATUS="not_found"

  # Search issues with labels pipeline,bug whose title starts with [Pipeline] CI Build Failure
  local issues_json
  issues_json=$(gh issue list --repo "$REPO" --state all --label pipeline --label bug \
    --limit 50 --json number,title,body,url,createdAt 2>/dev/null || echo "[]")

  # Primary: exact drill marker match when the router stamped drill metadata
  local matched=""
  if [ -n "$SOURCE_DRILL_ID" ]; then
    matched=$(echo "$issues_json" | jq -r --arg drill_id "$SOURCE_DRILL_ID" '
      [.[] | select(
        (.title | startswith("[Pipeline] CI Build Failure")) and
        (.body | contains("drill_id=" + $drill_id))
      )] | sort_by(.createdAt) | last // empty' 2>/dev/null || true)
  fi

  # Secondary: match body against commit SHA or run URL
  if [ -n "$commit" ] || [ -n "$run_url" ]; then
    if [ -z "$matched" ] || [ "$matched" = "null" ]; then
      matched=$(echo "$issues_json" | jq -r --arg commit "$commit" --arg run_url "$run_url" '
        [.[] | select(
          (.title | startswith("[Pipeline] CI Build Failure")) and
          (
            ($commit != "" and (.body | contains($commit))) or
            ($run_url != "" and (.body | contains($run_url)))
          )
        )] | first // empty' 2>/dev/null || true)
    fi
  fi

  # Fallback: if SHA/URL match found nothing, use time-window match.
  # The CI Failure Router may fire on a subsequent run with a different commit/URL,
  # so the issue body won't contain the original drill commit. Match by:
  # title prefix + created within 30 minutes after the CI failure timestamp.
  if { [ -z "$matched" ] || [ "$matched" = "null" ]; } && [ -n "$CI_FAIL_TIMESTAMP" ]; then
    local ci_fail_epoch window_end_epoch
    ci_fail_epoch=$(iso_to_epoch "$CI_FAIL_TIMESTAMP")
    window_end_epoch=$((ci_fail_epoch + 1800))  # 30-minute window
    matched=$(echo "$issues_json" | jq -r --arg ci_epoch "$ci_fail_epoch" --arg window_epoch "$window_end_epoch" '
      [.[] | select(
        (.title | startswith("[Pipeline] CI Build Failure")) and
        ((.createdAt | fromdate) >= ($ci_epoch | tonumber)) and
        ((.createdAt | fromdate) <= ($window_epoch | tonumber))
      )] | sort_by(.createdAt) | first // empty' 2>/dev/null || true)
  fi

  if [ -n "$matched" ] && [ "$matched" != "null" ]; then
    ISSUE_NUMBER=$(echo "$matched" | jq -r '.number')
    ISSUE_URL=$(echo "$matched" | jq -r '.url')
    ISSUE_TIMESTAMP=$(echo "$matched" | jq -r '.createdAt')
    ISSUE_STATUS="pass"
  fi
}

# find_dispatch(issue_number) — find repo-assist run linked to this issue
# Derives dispatch workflow from the triggering provenance.
# Sets: DISPATCH_WORKFLOW, REPO_ASSIST_RUN_ID, REPO_ASSIST_RUN_URL, DISPATCH_TIMESTAMP, DISPATCH_STATUS
find_dispatch() {
  local issue_number="$1"
  DISPATCH_WORKFLOW=""
  REPO_ASSIST_RUN_ID=""
  REPO_ASSIST_RUN_URL=""
  DISPATCH_TIMESTAMP=""
  DISPATCH_STATUS="not_found"
  DISPATCH_EVIDENCE_SOURCE=""

  local marker_json
  marker_json=$(find_marker_comment "$issue_number" '<!-- self-healing-dispatch:v1')
  local marker_body
  marker_body=$(printf '%s' "$marker_json" | jq -r '.body // ""')
  if [ -n "$marker_body" ]; then
    DISPATCH_WORKFLOW=$(read_marker_field "$marker_body" "dispatch_workflow")
    REPO_ASSIST_RUN_ID=$(read_marker_field "$marker_body" "repo_assist_run_id")
    REPO_ASSIST_RUN_URL=$(read_marker_field "$marker_body" "repo_assist_run_url")
    DISPATCH_TIMESTAMP=$(read_marker_field "$marker_body" "dispatched_at")
    if [ -z "$DISPATCH_TIMESTAMP" ]; then
      DISPATCH_TIMESTAMP=$(printf '%s' "$marker_json" | jq -r '.created_at // ""')
    fi
    if [ -n "$DISPATCH_WORKFLOW" ] || [ -n "$REPO_ASSIST_RUN_ID" ]; then
      DISPATCH_STATUS="pass"
      DISPATCH_EVIDENCE_SOURCE="issue_comment_marker"
      return
    fi
  fi

  # Find Pipeline Repo Assist runs created after the issue
  local runs_json
  runs_json=$(gh api "repos/${REPO}/actions/runs?per_page=50" \
    --jq '.workflow_runs' 2>/dev/null || echo "[]")

  # Get issue creation time for filtering
  local issue_created_at
  issue_created_at=$(gh api "repos/${REPO}/issues/${issue_number}" \
    --jq '.created_at' 2>/dev/null || echo "")

  if [ -z "$issue_created_at" ]; then
    return
  fi

  local issue_epoch
  issue_epoch=$(iso_to_epoch "$issue_created_at")

  # Find "Pipeline Repo Assist" runs created after the issue
  local repo_assist_runs
  repo_assist_runs=$(echo "$runs_json" | jq -r --arg name "Pipeline Repo Assist" \
    '[.[] | select(.name == $name)] | sort_by(.created_at)' 2>/dev/null || echo "[]")

  local run_count
  run_count=$(echo "$repo_assist_runs" | jq 'length')

  local i=0
  while [ "$i" -lt "$run_count" ]; do
    local run_created_at run_id
    run_created_at=$(echo "$repo_assist_runs" | jq -r ".[$i].created_at")
    run_id=$(echo "$repo_assist_runs" | jq -r ".[$i].id")

    local run_epoch
    run_epoch=$(iso_to_epoch "$run_created_at")

    # Only consider runs that started after the issue was created
    if [ "$run_epoch" -ge "$issue_epoch" ]; then
      # Check the triggering actor for this run
      local run_detail
      run_detail=$(gh api "repos/${REPO}/actions/runs/${run_id}" 2>/dev/null || echo "{}")

      local triggering_actor
      triggering_actor=$(echo "$run_detail" | jq -r '.triggering_actor.login // ""')

      # Record the run regardless — this is the repair attempt for this issue
      REPO_ASSIST_RUN_ID="$run_id"
      REPO_ASSIST_RUN_URL=$(echo "$repo_assist_runs" | jq -r ".[$i].html_url")
      DISPATCH_TIMESTAMP="$run_created_at"

      # Determine dispatch workflow from provenance
      # If triggered by github-actions[bot], it came through Auto-Dispatch Pipeline Issues
      # Tier 1 only passes when the dispatch workflow is Auto-Dispatch Pipeline Issues
      if [ "$triggering_actor" = "github-actions[bot]" ]; then
        DISPATCH_WORKFLOW="Auto-Dispatch Pipeline Issues"
        DISPATCH_STATUS="pass"
      else
        # Triggered by another actor — not via Auto-Dispatch
        DISPATCH_WORKFLOW="manual-or-other (triggered by: ${triggering_actor})"
        DISPATCH_STATUS="pass"
      fi
      DISPATCH_EVIDENCE_SOURCE="heuristic:first_repo_assist_after_issue"
      break
    fi

    i=$((i + 1))
  done
}

# find_repair_pr(issue_number) — find PR that closes the issue
# Sets: REPAIR_PR_NUMBER, REPAIR_PR_URL, REPAIR_PR_TIMESTAMP, REPAIR_PR_STATUS
find_repair_pr() {
  local issue_number="$1"
  REPAIR_PR_NUMBER=""
  REPAIR_PR_URL=""
  REPAIR_PR_TIMESTAMP=""
  REPAIR_PR_STATUS="not_found"

  # Look for PRs that reference "Closes #N" or "Fixes #N" for this issue
  local prs_json
  prs_json=$(gh pr list --repo "$REPO" --state all --limit 50 \
    --json number,title,body,url,createdAt 2>/dev/null || echo "[]")

  local matched
  matched=$(echo "$prs_json" | jq -r --arg issue_num "$issue_number" '
    [.[] | select(
      (.title | startswith("[Pipeline]")) and
      (.body | test("(?i)(close[ds]?|fix(?:e[ds])?|resolve[ds]?)\\s+#" + $issue_num + "\\b"))
    )] | sort_by(.createdAt) | last // empty' 2>/dev/null || true)

  if [ -n "$matched" ] && [ "$matched" != "null" ]; then
    REPAIR_PR_NUMBER=$(echo "$matched" | jq -r '.number')
    REPAIR_PR_URL=$(echo "$matched" | jq -r '.url')
    REPAIR_PR_TIMESTAMP=$(echo "$matched" | jq -r '.createdAt')
    REPAIR_PR_STATUS="pass"
  fi
}

# find_ci_green(pr_number) — find passing CI on the PR
# Sets: CI_GREEN_RUN_URL, CI_GREEN_TIMESTAMP, CI_GREEN_STATUS
find_ci_green() {
  local pr_number="$1"
  CI_GREEN_RUN_URL=""
  CI_GREEN_TIMESTAMP=""
  CI_GREEN_STATUS="not_found"

  # Get PR head SHA
  local pr_json
  pr_json=$(gh pr view "$pr_number" --repo "$REPO" --json headRefOid 2>/dev/null || echo "{}")
  local head_sha
  head_sha=$(echo "$pr_json" | jq -r '.headRefOid // ""')

  if [ -z "$head_sha" ]; then
    return
  fi

  # Check commit status / check runs
  local check_runs
  check_runs=$(gh api "repos/${REPO}/commits/${head_sha}/check-runs?per_page=50" \
    --jq '.check_runs' 2>/dev/null || echo "[]")

  # Look for a passing .NET CI check
  local passing
  passing=$(echo "$check_runs" | jq -r '
    [.[] | select(.conclusion == "success" and (.name | test("build-and-test|dotnet|.NET CI"; "i")))]
    | first // empty' 2>/dev/null || true)

  if [ -n "$passing" ] && [ "$passing" != "null" ]; then
    CI_GREEN_RUN_URL=$(echo "$passing" | jq -r '.html_url // .details_url // ""')
    CI_GREEN_TIMESTAMP=$(echo "$passing" | jq -r '.completed_at // .started_at // ""')
    CI_GREEN_STATUS="pass"
    return
  fi

  # Fallback: check via actions runs on the head SHA
  local runs_json
  runs_json=$(gh api "repos/${REPO}/actions/runs?head_sha=${head_sha}&per_page=50" \
    --jq '.workflow_runs' 2>/dev/null || echo "[]")

  passing=$(echo "$runs_json" | jq -r '
    [.[] | select(.conclusion == "success" and (.name == ".NET CI" or .name == "Deploy to Azure"))]
    | first // empty' 2>/dev/null || true)

  if [ -n "$passing" ] && [ "$passing" != "null" ]; then
    CI_GREEN_RUN_URL=$(echo "$passing" | jq -r '.html_url')
    CI_GREEN_TIMESTAMP=$(echo "$passing" | jq -r '.updated_at // .created_at')
    CI_GREEN_STATUS="pass"
  fi
}

# find_merge(pr_number) — check merge status + auto_merge_armed_observed
# Sets: MERGE_SHA, MERGE_TIMESTAMP, MERGED_BY, AUTO_MERGE_ARMED, MERGE_STATUS
find_merge() {
  local pr_number="$1"
  MERGE_SHA=""
  MERGE_TIMESTAMP=""
  MERGED_BY=""
  AUTO_MERGE_ARMED=false
  AUTO_MERGE_EVIDENCE_SOURCE=""
  MERGE_STATUS="not_found"

  local pr_json
  pr_json=$(gh api "repos/${REPO}/pulls/${pr_number}" 2>/dev/null || echo "{}")

  local state
  state=$(echo "$pr_json" | jq -r '.state // ""')
  local merged
  merged=$(echo "$pr_json" | jq -r '.merged // false')
  local pr_head_sha
  pr_head_sha=$(echo "$pr_json" | jq -r '.head.sha // ""')

  # Check auto_merge field while PR is still open
  local auto_merge_field
  auto_merge_field=$(echo "$pr_json" | jq -r '.auto_merge // null')
  if [ "$auto_merge_field" != "null" ] && [ -n "$auto_merge_field" ]; then
    AUTO_MERGE_ARMED=true
    AUTO_MERGE_EVIDENCE_SOURCE="pulls_api:auto_merge"
  fi

  # Durable evidence: explicit commit status written when auto-merge was armed
  if [ "$AUTO_MERGE_ARMED" = "false" ] && [ -n "$pr_head_sha" ]; then
    local auto_merge_status_count
    auto_merge_status_count=$(gh api "repos/${REPO}/commits/${pr_head_sha}/statuses?per_page=100" \
      --jq '[.[] | select(.context == "auto-merge-armed" and .state == "success")] | length' 2>/dev/null || echo "0")
    if [ "$auto_merge_status_count" -gt 0 ]; then
      AUTO_MERGE_ARMED=true
      AUTO_MERGE_EVIDENCE_SOURCE="commit_status:auto-merge-armed"
    fi
  fi

  # If not armed via field, check durable evidence from PR timeline
  if [ "$AUTO_MERGE_ARMED" = "false" ]; then
    local timeline_events
    timeline_events=$(gh api "repos/${REPO}/issues/${pr_number}/timeline?per_page=100" \
      --jq '[.[] | select(.event == "auto_merge_enabled")] | length' 2>/dev/null || echo "0")
    if [ "$timeline_events" -gt 0 ]; then
      AUTO_MERGE_ARMED=true
      AUTO_MERGE_EVIDENCE_SOURCE="timeline:auto_merge_enabled"
    fi
  fi

  # If still not armed, check if PR Review Submit workflow succeeded on this PR's head SHA
  if [ "$AUTO_MERGE_ARMED" = "false" ]; then
    if [ -n "$pr_head_sha" ]; then
      local pr_review_runs
      pr_review_runs=$(gh api "repos/${REPO}/actions/runs?head_sha=${pr_head_sha}&per_page=50" \
        --jq '.workflow_runs' 2>/dev/null || echo "[]")
      local review_submit_success
      review_submit_success=$(echo "$pr_review_runs" | jq -r '
        [.[] | select(.name == "PR Review Submit" and .conclusion == "success")] | length' 2>/dev/null || echo "0")
      if [ "$review_submit_success" -gt 0 ]; then
        # PR Review Submit succeeded on this PR's head SHA — it's the workflow that arms auto-merge for [Pipeline] PRs
        AUTO_MERGE_ARMED=true
        AUTO_MERGE_EVIDENCE_SOURCE="actions_run:PR Review Submit"
      fi
    fi
  fi

  if [ "$merged" = "true" ]; then
    MERGE_SHA=$(echo "$pr_json" | jq -r '.merge_commit_sha // ""')
    MERGE_TIMESTAMP=$(echo "$pr_json" | jq -r '.merged_at // ""')
    MERGED_BY=$(echo "$pr_json" | jq -r '.merged_by.login // ""')
    MERGE_STATUS="pass"
  fi
}

# find_main_recovery(merge_commit) — find successful Deploy to Azure on merge commit
# Sets: RECOVERY_RUN_URL, RECOVERY_TIMESTAMP, RECOVERY_STATUS
find_main_recovery() {
  local merge_commit="$1"
  RECOVERY_RUN_URL=""
  RECOVERY_TIMESTAMP=""
  RECOVERY_STATUS="not_found"

  local runs_json
  runs_json=$(gh api "repos/${REPO}/actions/runs?head_sha=${merge_commit}&per_page=50" \
    --jq '.workflow_runs' 2>/dev/null || echo "[]")

  local passing
  passing=$(echo "$runs_json" | jq -r '
    [.[] | select(.conclusion == "success" and .name == "Deploy to Azure")]
    | first // empty' 2>/dev/null || true)

  if [ -n "$passing" ] && [ "$passing" != "null" ]; then
    RECOVERY_RUN_URL=$(echo "$passing" | jq -r '.html_url')
    RECOVERY_TIMESTAMP=$(echo "$passing" | jq -r '.updated_at // .created_at')
    RECOVERY_STATUS="pass"
  fi
}

# ---------------------------------------------------------------------------
# Helper: poll_until — poll a finder function until it succeeds or times out
# ---------------------------------------------------------------------------
poll_until() {
  local finder_func="$1"
  local status_var="$2"
  local max_wait_s="$3"
  shift 3
  # remaining args are passed to the finder

  local start_epoch
  start_epoch=$(now_epoch)
  local deadline=$((start_epoch + max_wait_s))

  while true; do
    "$finder_func" "$@"

    local current_status
    current_status="${!status_var}"

    if [ "$current_status" = "pass" ]; then
      return 0
    fi

    local now
    now=$(now_epoch)
    if [ "$now" -ge "$deadline" ]; then
      return 1  # timeout
    fi

    # Check overall drill timeout
    if [ -n "$DRILL_START_EPOCH" ]; then
      local overall_deadline=$((DRILL_START_EPOCH + OVERALL_TIMEOUT_S))
      if [ "$now" -ge "$overall_deadline" ]; then
        return 1
      fi
    fi

    sleep "$POLL_INTERVAL"
  done
}

# ---------------------------------------------------------------------------
# Helper: build a stage JSON object with optional extra key=value pairs
# ---------------------------------------------------------------------------
make_stage() {
  local status="$1"
  local timestamp="$2"
  local url="$3"
  local elapsed="$4"
  local sla="$5"
  shift 5

  local base
  base=$(jq -n \
    --arg status "$status" \
    --arg timestamp "$timestamp" \
    --arg url "$url" \
    --argjson elapsed "${elapsed:-null}" \
    --argjson sla "$sla" \
    '{
      status: $status,
      timestamp: $timestamp,
      url: $url,
      elapsed_from_previous_s: $elapsed,
      sla_s: $sla
    }')

  # Add extra key=value pairs
  for kv in "$@"; do
    local k="${kv%%=*}"
    local v="${kv#*=}"
    local tmp
    tmp=$(echo "$base" | jq --arg k "$k" --arg v "$v" '. + {($k): $v}')
    base="$tmp"
  done

  echo "$base"
}

# ---------------------------------------------------------------------------
# elapsed_between — compute seconds between two ISO timestamps
# ---------------------------------------------------------------------------
elapsed_between() {
  local start_iso="$1"
  local end_iso="$2"

  if [ -z "$start_iso" ] || [ -z "$end_iso" ]; then
    echo "null"
    return
  fi

  local s e
  s=$(iso_to_epoch "$start_iso")
  e=$(iso_to_epoch "$end_iso")

  if [ "$s" = "0" ] || [ "$e" = "0" ]; then
    echo "null"
    return
  fi

  echo $((e - s))
}

# ---------------------------------------------------------------------------
# Layer 3: Modes — run_drill
# ---------------------------------------------------------------------------

preflight_run() {
  log_stage "preflight" "info" "Checking prerequisites..."

  # 1. Current branch is main
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  if [ "$branch" != "main" ]; then
    log_stage "preflight" "fail" "Current branch is '$branch', must be 'main'"
    return 1
  fi

  # 2. Working tree is clean
  local dirty
  dirty=$(git status --porcelain 2>/dev/null || echo "dirty")
  if [ -n "$dirty" ]; then
    log_stage "preflight" "fail" "Working tree is not clean"
    return 1
  fi

  # 3. gh auth status succeeds
  if ! gh auth status >/dev/null 2>&1; then
    log_stage "preflight" "fail" "gh auth status failed"
    return 1
  fi

  log_stage "preflight" "pass" "All checks passed"
  return 0
}

inject_fault() {
  log_stage "inject" "info" "Injecting deliberate build failure..." >&2

  DRILL_ID="$(date -u +%Y%m%d-%H%M%S)"

  # Write broken canary (missing semicolon => CS1002)
  cat > "$CANARY_FILE" << 'CANARY_EOF'
namespace TicketDeflection.Canary;

/// <summary>
/// Canary class for self-healing drill suite.
/// This file is intentionally simple. The drill harness injects
/// a compiler error here; the pipeline agent's job is to fix it.
/// DO NOT add logic or references to this class.
/// </summary>
public static class DrillCanary
{
    public static string Status() => "broken"
}
CANARY_EOF

  # Commit and push
  git add "$CANARY_FILE"
  git commit -m "drill(main_build_syntax): inject deliberate build failure [drill-id:${DRILL_ID}]"

  local commit_sha
  commit_sha=$(git rev-parse HEAD)

  if ! git push origin main; then
    log_stage "inject" "fail" "git push failed" >&2
    return 1
  fi

  log_stage "inject" "pass" "Pushed fault commit ${commit_sha:0:8}" >&2
  echo "$commit_sha"
}

run_drill() {
  local drill_type="${1:-main_build_syntax}"

  # Preflight checks — fail fast on failure
  if ! preflight_run; then
    exit 2
  fi

  # Inject the fault
  local injected_commit
  injected_commit=$(inject_fault)
  if [ -z "$injected_commit" ]; then
    log_stage "inject" "fail" "Fault injection failed"
    exit 2
  fi

  SOURCE_DRILL_ID="$DRILL_ID"

  # Initialize report
  init_report "$drill_type" "$injected_commit"
  update_top_level "source_drill_id" "$SOURCE_DRILL_ID"
  update_top_level "failure_signature" "cs1002-missing-semicolon"

  local prev_timestamp
  prev_timestamp="$(now_iso)"

  # --- Stage 1: CI Failure ---
  log_stage "ci_failure" "searching" "Waiting for CI failure on ${injected_commit:0:8}..."
  local max_wait=$((SLA_FAILURE_TO_ISSUE * 2))

  if poll_until find_ci_failure CI_FAIL_STATUS "$max_wait" "$injected_commit"; then
    local elapsed
    elapsed=$(elapsed_between "$prev_timestamp" "$CI_FAIL_TIMESTAMP")
    local stage_json
    stage_json=$(make_stage "pass" "$CI_FAIL_TIMESTAMP" "$CI_FAIL_RUN_URL" "$elapsed" "$SLA_FAILURE_TO_ISSUE" \
      "run_id=${CI_FAIL_RUN_ID}")
    update_stage "ci_failure" "$stage_json"
    log_stage "ci_failure" "pass" "Failing run: ${CI_FAIL_RUN_URL}"
    prev_timestamp="$CI_FAIL_TIMESTAMP"
  else
    local stage_json
    stage_json=$(make_stage "timeout" "" "" "null" "$SLA_FAILURE_TO_ISSUE")
    update_stage "ci_failure" "$stage_json"
    log_stage "ci_failure" "timeout" "No failing CI run found within ${max_wait}s"
    # Continue — later stages may still be findable
  fi

  # --- Stage 2: Issue Created ---
  log_stage "issue_created" "searching" "Waiting for [Pipeline] CI Build Failure issue..."
  max_wait=$((SLA_FAILURE_TO_ISSUE * 2))

  if [ -n "$CI_FAIL_RUN_ID" ]; then
    if poll_until find_issue ISSUE_STATUS "$max_wait" "$injected_commit" "$CI_FAIL_RUN_ID" "$CI_FAIL_RUN_URL"; then
      local elapsed
      elapsed=$(elapsed_between "$prev_timestamp" "$ISSUE_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$ISSUE_TIMESTAMP" "$ISSUE_URL" "$elapsed" "$SLA_FAILURE_TO_ISSUE" \
        "issue_number=${ISSUE_NUMBER}")
      update_stage "issue_created" "$stage_json"
      log_stage "issue_created" "pass" "Issue #${ISSUE_NUMBER}: ${ISSUE_URL}"
      prev_timestamp="$ISSUE_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "timeout" "" "" "null" "$SLA_FAILURE_TO_ISSUE")
      update_stage "issue_created" "$stage_json"
      log_stage "issue_created" "timeout" "No matching issue found within ${max_wait}s"
    fi
  else
    # No CI failure found, but still try to find the issue by commit
    if poll_until find_issue ISSUE_STATUS "$max_wait" "$injected_commit" "" ""; then
      local elapsed
      elapsed=$(elapsed_between "$prev_timestamp" "$ISSUE_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$ISSUE_TIMESTAMP" "$ISSUE_URL" "$elapsed" "$SLA_FAILURE_TO_ISSUE" \
        "issue_number=${ISSUE_NUMBER}")
      update_stage "issue_created" "$stage_json"
      log_stage "issue_created" "pass" "Issue #${ISSUE_NUMBER}: ${ISSUE_URL}"
      prev_timestamp="$ISSUE_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "timeout" "" "" "null" "$SLA_FAILURE_TO_ISSUE")
      update_stage "issue_created" "$stage_json"
      log_stage "issue_created" "timeout" "No matching issue found within ${max_wait}s"
    fi
  fi

  # --- Stage 3: Dispatch ---
  if [ -n "$ISSUE_NUMBER" ]; then
    log_stage "auto_dispatch" "searching" "Waiting for repo-assist dispatch for issue #${ISSUE_NUMBER}..."
    max_wait=$((SLA_ISSUE_TO_DISPATCH * 2))

    if poll_until find_dispatch DISPATCH_STATUS "$max_wait" "$ISSUE_NUMBER"; then
      local elapsed
      elapsed=$(elapsed_between "$prev_timestamp" "$DISPATCH_TIMESTAMP")
      # Stage status is "pass" only when dispatch came via Auto-Dispatch Pipeline Issues
      local dispatch_stage_status="pass"
      if [ "$DISPATCH_WORKFLOW" != "Auto-Dispatch Pipeline Issues" ]; then
        dispatch_stage_status="fail"
      fi
      local stage_json
      stage_json=$(make_stage "$dispatch_stage_status" "$DISPATCH_TIMESTAMP" "$REPO_ASSIST_RUN_URL" "$elapsed" "$SLA_ISSUE_TO_DISPATCH" \
        "dispatch_workflow=${DISPATCH_WORKFLOW}" \
        "dispatch_evidence_source=${DISPATCH_EVIDENCE_SOURCE}" \
        "repo_assist_run_id=${REPO_ASSIST_RUN_ID}" \
        "repo_assist_run_url=${REPO_ASSIST_RUN_URL}")
      update_stage "auto_dispatch" "$stage_json"
      update_top_level "dispatch_workflow" "$DISPATCH_WORKFLOW"
      log_stage "auto_dispatch" "$dispatch_stage_status" "Dispatch: ${DISPATCH_WORKFLOW} -> run ${REPO_ASSIST_RUN_ID}"
      prev_timestamp="$DISPATCH_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "timeout" "" "" "null" "$SLA_ISSUE_TO_DISPATCH")
      update_stage "auto_dispatch" "$stage_json"
      log_stage "auto_dispatch" "timeout" "No dispatch found within ${max_wait}s"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_ISSUE_TO_DISPATCH" \
      "reason=no_issue_found")
    update_stage "auto_dispatch" "$stage_json"
    log_stage "auto_dispatch" "fail" "Skipped — no issue found to dispatch from"
  fi

  # --- Stage 4: Repair PR ---
  if [ -n "$ISSUE_NUMBER" ]; then
    log_stage "repair_pr" "searching" "Waiting for repair PR for issue #${ISSUE_NUMBER}..."
    max_wait=$((SLA_DISPATCH_TO_PR * 2))

    if poll_until find_repair_pr REPAIR_PR_STATUS "$max_wait" "$ISSUE_NUMBER"; then
      local elapsed
      elapsed=$(elapsed_between "$prev_timestamp" "$REPAIR_PR_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$REPAIR_PR_TIMESTAMP" "$REPAIR_PR_URL" "$elapsed" "$SLA_DISPATCH_TO_PR" \
        "pr_number=${REPAIR_PR_NUMBER}")
      update_stage "repair_pr" "$stage_json"
      log_stage "repair_pr" "pass" "PR #${REPAIR_PR_NUMBER}: ${REPAIR_PR_URL}"
      prev_timestamp="$REPAIR_PR_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "timeout" "" "" "null" "$SLA_DISPATCH_TO_PR")
      update_stage "repair_pr" "$stage_json"
      log_stage "repair_pr" "timeout" "No repair PR found within ${max_wait}s"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_DISPATCH_TO_PR" \
      "reason=no_issue_found")
    update_stage "repair_pr" "$stage_json"
    log_stage "repair_pr" "fail" "Skipped — no issue to find PR for"
  fi

  # --- Stage 5: CI Green ---
  if [ -n "$REPAIR_PR_NUMBER" ]; then
    log_stage "ci_green" "searching" "Waiting for passing CI on PR #${REPAIR_PR_NUMBER}..."
    max_wait=$((SLA_PR_TO_GREEN * 2))

    if poll_until find_ci_green CI_GREEN_STATUS "$max_wait" "$REPAIR_PR_NUMBER"; then
      local elapsed
      elapsed=$(elapsed_between "$prev_timestamp" "$CI_GREEN_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$CI_GREEN_TIMESTAMP" "$CI_GREEN_RUN_URL" "$elapsed" "$SLA_PR_TO_GREEN")
      update_stage "ci_green" "$stage_json"
      log_stage "ci_green" "pass" "CI green: ${CI_GREEN_RUN_URL}"
      prev_timestamp="$CI_GREEN_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "timeout" "" "" "null" "$SLA_PR_TO_GREEN")
      update_stage "ci_green" "$stage_json"
      log_stage "ci_green" "timeout" "No passing CI found within ${max_wait}s"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_PR_TO_GREEN" \
      "reason=no_repair_pr_found")
    update_stage "ci_green" "$stage_json"
    log_stage "ci_green" "fail" "Skipped — no repair PR to check CI for"
  fi

  # --- Stage 6: Merge ---
  if [ -n "$REPAIR_PR_NUMBER" ]; then
    log_stage "auto_merge" "searching" "Waiting for PR #${REPAIR_PR_NUMBER} to merge..."
    max_wait=$((SLA_GREEN_TO_MERGE * 2))

    if poll_until find_merge MERGE_STATUS "$max_wait" "$REPAIR_PR_NUMBER"; then
      local elapsed
      elapsed=$(elapsed_between "$prev_timestamp" "$MERGE_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$MERGE_TIMESTAMP" "" "$elapsed" "$SLA_GREEN_TO_MERGE" \
        "merge_sha=${MERGE_SHA}" \
        "merged_by=${MERGED_BY}" \
        "auto_merge_armed_observed=${AUTO_MERGE_ARMED}" \
        "auto_merge_evidence_source=${AUTO_MERGE_EVIDENCE_SOURCE}")
      update_stage "auto_merge" "$stage_json"
      log_stage "auto_merge" "pass" "Merged by ${MERGED_BY}, auto-merge armed: ${AUTO_MERGE_ARMED}"
      prev_timestamp="$MERGE_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "timeout" "" "" "null" "$SLA_GREEN_TO_MERGE" \
        "auto_merge_armed_observed=${AUTO_MERGE_ARMED}" \
        "auto_merge_evidence_source=${AUTO_MERGE_EVIDENCE_SOURCE}")
      update_stage "auto_merge" "$stage_json"
      log_stage "auto_merge" "timeout" "PR not merged within ${max_wait}s"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_GREEN_TO_MERGE" \
      "reason=no_repair_pr_found")
    update_stage "auto_merge" "$stage_json"
    log_stage "auto_merge" "fail" "Skipped — no repair PR to check merge for"
  fi

  # --- Stage 7: Main Recovery ---
  if [ -n "$MERGE_SHA" ]; then
    log_stage "main_recovered" "searching" "Waiting for Deploy to Azure on merge commit..."
    max_wait=$((SLA_MERGE_TO_RECOVERY * 2))

    if poll_until find_main_recovery RECOVERY_STATUS "$max_wait" "$MERGE_SHA"; then
      local elapsed
      elapsed=$(elapsed_between "$prev_timestamp" "$RECOVERY_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$RECOVERY_TIMESTAMP" "$RECOVERY_RUN_URL" "$elapsed" "$SLA_MERGE_TO_RECOVERY")
      update_stage "main_recovered" "$stage_json"
      log_stage "main_recovered" "pass" "Recovery: ${RECOVERY_RUN_URL}"
    else
      local stage_json
      stage_json=$(make_stage "timeout" "" "" "null" "$SLA_MERGE_TO_RECOVERY")
      update_stage "main_recovered" "$stage_json"
      log_stage "main_recovered" "timeout" "No recovery deploy found within ${max_wait}s"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_MERGE_TO_RECOVERY" \
      "reason=no_merge_sha")
    update_stage "main_recovered" "$stage_json"
    log_stage "main_recovered" "fail" "Skipped — no merge commit to check recovery for"
  fi

  # --- Compute verdict ---
  compute_verdict

  # --- Cleanup: sync local main to healed remote state ---
  local verdict
  verdict=$(jq -r '.verdict' "$REPORT_FILE")
  local recovered_status
  recovered_status=$(jq -r '.stages.main_recovered.status // ""' "$REPORT_FILE")
  if [ "$recovered_status" = "pass" ]; then
    log_stage "cleanup" "info" "Syncing local main to healed remote state..."
    git fetch origin main
    git merge --ff-only origin/main
    log_stage "cleanup" "pass" "Local main synced"
  fi

  # --- Print summary ---
  print_summary

  if [ "$verdict" = "PASS" ]; then
    exit 0
  else
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Layer 3: Modes — run_audit
# ---------------------------------------------------------------------------
run_audit() {
  local commit="$1"

  SOURCE_DRILL_ID=$(extract_drill_id_for_commit "$commit")

  # Initialize report
  DRILL_ID="audit-$(date -u +%Y%m%d-%H%M%S)"
  init_report "audit" "$commit"
  update_top_level "source_drill_id" "$SOURCE_DRILL_ID"

  log_stage "audit" "info" "Auditing drill for commit ${commit:0:8}..."

  local prev_timestamp=""

  # --- Stage 1: CI Failure ---
  find_ci_failure "$commit"
  if [ "$CI_FAIL_STATUS" = "pass" ]; then
    local stage_json
    stage_json=$(make_stage "pass" "$CI_FAIL_TIMESTAMP" "$CI_FAIL_RUN_URL" "null" "$SLA_FAILURE_TO_ISSUE" \
      "run_id=${CI_FAIL_RUN_ID}")
    update_stage "ci_failure" "$stage_json"
    log_stage "ci_failure" "pass" "Failing run: ${CI_FAIL_RUN_URL}"
    prev_timestamp="$CI_FAIL_TIMESTAMP"
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_FAILURE_TO_ISSUE")
    update_stage "ci_failure" "$stage_json"
    log_stage "ci_failure" "fail" "No failing CI run found for commit ${commit:0:8}"
  fi

  # --- Stage 2: Issue Created ---
  find_issue "$commit" "${CI_FAIL_RUN_ID:-}" "${CI_FAIL_RUN_URL:-}"
  if [ "$ISSUE_STATUS" = "pass" ]; then
    local elapsed
    elapsed=$(elapsed_between "${prev_timestamp:-}" "$ISSUE_TIMESTAMP")
    local stage_json
    stage_json=$(make_stage "pass" "$ISSUE_TIMESTAMP" "$ISSUE_URL" "$elapsed" "$SLA_FAILURE_TO_ISSUE" \
      "issue_number=${ISSUE_NUMBER}")
    update_stage "issue_created" "$stage_json"
    log_stage "issue_created" "pass" "Issue #${ISSUE_NUMBER}: ${ISSUE_URL}"
    prev_timestamp="$ISSUE_TIMESTAMP"
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_FAILURE_TO_ISSUE")
    update_stage "issue_created" "$stage_json"
    log_stage "issue_created" "fail" "No matching issue found"
  fi

  # --- Stage 3: Dispatch ---
  if [ -n "${ISSUE_NUMBER:-}" ]; then
    find_dispatch "$ISSUE_NUMBER"
    if [ "$DISPATCH_STATUS" = "pass" ]; then
      local elapsed
      elapsed=$(elapsed_between "${prev_timestamp:-}" "$DISPATCH_TIMESTAMP")
      # Stage status is "pass" only when dispatch came via Auto-Dispatch Pipeline Issues
      local dispatch_stage_status="pass"
      if [ "$DISPATCH_WORKFLOW" != "Auto-Dispatch Pipeline Issues" ]; then
        dispatch_stage_status="fail"
      fi
      local stage_json
      stage_json=$(make_stage "$dispatch_stage_status" "$DISPATCH_TIMESTAMP" "$REPO_ASSIST_RUN_URL" "$elapsed" "$SLA_ISSUE_TO_DISPATCH" \
        "dispatch_workflow=${DISPATCH_WORKFLOW}" \
        "dispatch_evidence_source=${DISPATCH_EVIDENCE_SOURCE}" \
        "repo_assist_run_id=${REPO_ASSIST_RUN_ID}" \
        "repo_assist_run_url=${REPO_ASSIST_RUN_URL}")
      update_stage "auto_dispatch" "$stage_json"
      update_top_level "dispatch_workflow" "$DISPATCH_WORKFLOW"
      log_stage "auto_dispatch" "$dispatch_stage_status" "Dispatch: ${DISPATCH_WORKFLOW} -> run ${REPO_ASSIST_RUN_ID}"
      prev_timestamp="$DISPATCH_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "fail" "" "" "null" "$SLA_ISSUE_TO_DISPATCH")
      update_stage "auto_dispatch" "$stage_json"
      log_stage "auto_dispatch" "fail" "No dispatch found"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_ISSUE_TO_DISPATCH" \
      "reason=no_issue_found")
    update_stage "auto_dispatch" "$stage_json"
    log_stage "auto_dispatch" "fail" "Skipped — no issue found"
  fi

  # --- Stage 4: Repair PR ---
  if [ -n "${ISSUE_NUMBER:-}" ]; then
    find_repair_pr "$ISSUE_NUMBER"
    if [ "$REPAIR_PR_STATUS" = "pass" ]; then
      local elapsed
      elapsed=$(elapsed_between "${prev_timestamp:-}" "$REPAIR_PR_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$REPAIR_PR_TIMESTAMP" "$REPAIR_PR_URL" "$elapsed" "$SLA_DISPATCH_TO_PR" \
        "pr_number=${REPAIR_PR_NUMBER}")
      update_stage "repair_pr" "$stage_json"
      log_stage "repair_pr" "pass" "PR #${REPAIR_PR_NUMBER}: ${REPAIR_PR_URL}"
      prev_timestamp="$REPAIR_PR_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "fail" "" "" "null" "$SLA_DISPATCH_TO_PR")
      update_stage "repair_pr" "$stage_json"
      log_stage "repair_pr" "fail" "No repair PR found"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_DISPATCH_TO_PR" \
      "reason=no_issue_found")
    update_stage "repair_pr" "$stage_json"
    log_stage "repair_pr" "fail" "Skipped — no issue found"
  fi

  # --- Stage 5: CI Green ---
  if [ -n "${REPAIR_PR_NUMBER:-}" ]; then
    find_ci_green "$REPAIR_PR_NUMBER"
    if [ "$CI_GREEN_STATUS" = "pass" ]; then
      local elapsed
      elapsed=$(elapsed_between "${prev_timestamp:-}" "$CI_GREEN_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$CI_GREEN_TIMESTAMP" "$CI_GREEN_RUN_URL" "$elapsed" "$SLA_PR_TO_GREEN")
      update_stage "ci_green" "$stage_json"
      log_stage "ci_green" "pass" "CI green: ${CI_GREEN_RUN_URL}"
      prev_timestamp="$CI_GREEN_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "fail" "" "" "null" "$SLA_PR_TO_GREEN")
      update_stage "ci_green" "$stage_json"
      log_stage "ci_green" "fail" "No passing CI found on PR"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_PR_TO_GREEN" \
      "reason=no_repair_pr_found")
    update_stage "ci_green" "$stage_json"
    log_stage "ci_green" "fail" "Skipped — no repair PR found"
  fi

  # --- Stage 6: Merge ---
  if [ -n "${REPAIR_PR_NUMBER:-}" ]; then
    find_merge "$REPAIR_PR_NUMBER"
    if [ "$MERGE_STATUS" = "pass" ]; then
      local elapsed
      elapsed=$(elapsed_between "${prev_timestamp:-}" "$MERGE_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$MERGE_TIMESTAMP" "" "$elapsed" "$SLA_GREEN_TO_MERGE" \
        "merge_sha=${MERGE_SHA}" \
        "merged_by=${MERGED_BY}" \
        "auto_merge_armed_observed=${AUTO_MERGE_ARMED}" \
        "auto_merge_evidence_source=${AUTO_MERGE_EVIDENCE_SOURCE}")
      update_stage "auto_merge" "$stage_json"
      log_stage "auto_merge" "pass" "Merged by ${MERGED_BY}, auto-merge armed: ${AUTO_MERGE_ARMED}"
      prev_timestamp="$MERGE_TIMESTAMP"
    else
      local stage_json
      stage_json=$(make_stage "fail" "" "" "null" "$SLA_GREEN_TO_MERGE" \
        "auto_merge_armed_observed=${AUTO_MERGE_ARMED}" \
        "auto_merge_evidence_source=${AUTO_MERGE_EVIDENCE_SOURCE}")
      update_stage "auto_merge" "$stage_json"
      log_stage "auto_merge" "fail" "PR not merged"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_GREEN_TO_MERGE" \
      "reason=no_repair_pr_found")
    update_stage "auto_merge" "$stage_json"
    log_stage "auto_merge" "fail" "Skipped — no repair PR found"
  fi

  # --- Stage 7: Main Recovery ---
  if [ -n "${MERGE_SHA:-}" ]; then
    find_main_recovery "$MERGE_SHA"
    if [ "$RECOVERY_STATUS" = "pass" ]; then
      local elapsed
      elapsed=$(elapsed_between "${prev_timestamp:-}" "$RECOVERY_TIMESTAMP")
      local stage_json
      stage_json=$(make_stage "pass" "$RECOVERY_TIMESTAMP" "$RECOVERY_RUN_URL" "$elapsed" "$SLA_MERGE_TO_RECOVERY")
      update_stage "main_recovered" "$stage_json"
      log_stage "main_recovered" "pass" "Recovery: ${RECOVERY_RUN_URL}"
    else
      local stage_json
      stage_json=$(make_stage "fail" "" "" "null" "$SLA_MERGE_TO_RECOVERY")
      update_stage "main_recovered" "$stage_json"
      log_stage "main_recovered" "fail" "No recovery deploy found"
    fi
  else
    local stage_json
    stage_json=$(make_stage "fail" "" "" "null" "$SLA_MERGE_TO_RECOVERY" \
      "reason=no_merge_sha")
    update_stage "main_recovered" "$stage_json"
    log_stage "main_recovered" "fail" "Skipped — no merge commit found"
  fi

  # --- Compute verdict ---
  compute_verdict

  # --- Print summary ---
  print_summary

  local verdict
  verdict=$(jq -r '.verdict' "$REPORT_FILE")
  if [ "$verdict" = "PASS" ]; then
    exit 0
  else
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
usage() {
  echo "Usage:"
  echo "  $0 run main_build_syntax      — inject fault and observe pipeline healing"
  echo "  $0 audit <commit-sha>          — retroactively analyze a past drill"
  exit 2
}

main() {
  command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI required" >&2; exit 2; }
  command -v jq >/dev/null 2>&1 || { echo "Error: jq required" >&2; exit 2; }

  cd "$REPO_ROOT"

  if [ $# -lt 2 ]; then
    usage
  fi

  local mode="$1"
  local arg="$2"

  case "$mode" in
    run)
      if [ "$arg" != "main_build_syntax" ]; then
        echo "Error: only 'main_build_syntax' drill type is supported."
        exit 2
      fi
      run_drill "$arg"
      ;;
    audit)
      if [ -z "$arg" ]; then
        echo "Error: audit mode requires a commit SHA."
        exit 2
      fi
      run_audit "$arg"
      ;;
    *)
      usage
      ;;
  esac
}

main "$@"
