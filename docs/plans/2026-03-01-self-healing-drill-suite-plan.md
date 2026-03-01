# Self-Healing Drill Suite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local drill harness that injects a deterministic build failure, monitors the full self-healing pipeline via the GitHub API, and produces a structured JSON report with pass/fail verdicts against SLAs.

**Architecture:** Single bash script with two modes (`run` and `audit`) sharing a common finder/report/verdict code path. The `run` mode adds fault injection and polling on top of the shared logic. JSON reports are written incrementally after every stage update.

**Tech Stack:** Bash, `gh` CLI, `jq`, C# (canary file only)

---

### Task 1: Create the canary file

**Files:**
- Create: `TicketDeflection/Canary/DrillCanary.cs`

**Step 1: Create the canary directory and file**

```csharp
// TicketDeflection/Canary/DrillCanary.cs
namespace TicketDeflection.Canary;

/// <summary>
/// Canary class for self-healing drill suite.
/// This file is intentionally simple. The drill harness injects
/// a compiler error here; the pipeline agent's job is to fix it.
/// DO NOT add logic or references to this class.
/// </summary>
public static class DrillCanary
{
    public static string Status() => "healthy";
}
```

**Step 2: Verify it compiles**

Run from repo root:
```bash
dotnet build TicketDeflection/TicketDeflection.csproj
```
Expected: Build succeeded. 0 Error(s).

**Step 3: Commit**

```bash
git add TicketDeflection/Canary/DrillCanary.cs
git commit -m "feat: add drill canary file for self-healing test suite"
```

---

### Task 2: Set up drills directory and gitignore

**Files:**
- Create: `drills/reports/.gitkeep`
- Modify: `.gitignore`

**Step 1: Create drills directory structure**

```bash
mkdir -p drills/reports
touch drills/reports/.gitkeep
```

**Step 2: Add gitignore entry for drill reports**

Add to `.gitignore`:
```
# Drill reports (generated, not committed)
drills/reports/*.json
```

**Step 3: Commit**

```bash
git add drills/reports/.gitkeep .gitignore
git commit -m "chore: add drills/reports directory for self-healing drill output"
```

---

### Task 3: Write the script skeleton with shared core functions

This is the largest task. The script has three layers:
1. **Core** — JSON report management, printing, verdict logic
2. **Finders** — GitHub API queries for each stage (shared by `run` and `audit`)
3. **Modes** — `run` (inject + poll + find) and `audit` (find only)

**Files:**
- Create: `scripts/self-healing-drill.sh`

**Step 1: Write the script with constants, usage, and core functions**

```bash
#!/usr/bin/env bash
# Self-Healing Drill Suite
# Usage:
#   ./scripts/self-healing-drill.sh run main_build_syntax
#   ./scripts/self-healing-drill.sh audit <commit-sha>
set -euo pipefail

REPO="samuelkahessay/prd-to-prod"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORTS_DIR="$REPO_ROOT/drills/reports"
CANARY_FILE="$REPO_ROOT/TicketDeflection/Canary/DrillCanary.cs"
POLL_INTERVAL=15

# SLAs in seconds
SLA_FAILURE_TO_ISSUE=120
SLA_ISSUE_TO_DISPATCH=120
SLA_DISPATCH_TO_PR=600
SLA_PR_TO_GREEN=900
SLA_GREEN_TO_MERGE=600
SLA_MERGE_TO_RECOVERY=300
OVERALL_TIMEOUT=2700  # 45 minutes

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Core: Report Management ────────────────────────────────────────

init_report() {
  local drill_id="$1" drill_type="$2" commit="$3"
  mkdir -p "$REPORTS_DIR"
  REPORT_FILE="$REPORTS_DIR/${drill_id}.json"
  jq -n \
    --arg id "$drill_id" \
    --arg type "$drill_type" \
    --arg commit "$commit" \
    '{
      drill_id: $id,
      drill_type: $type,
      injected_commit: $commit,
      failure_signature: null,
      dispatch_workflow: null,
      stages: {},
      verdict: "IN_PROGRESS",
      failure_reason: null,
      total_elapsed_s: null
    }' > "$REPORT_FILE"
  echo "$REPORT_FILE"
}

update_stage() {
  local stage="$1"
  shift
  # Remaining args are key=value pairs
  local tmp
  tmp=$(mktemp)
  cp "$REPORT_FILE" "$tmp"
  # Build the stage object from args
  local stage_json="{}"
  while [ $# -gt 0 ]; do
    local key="${1%%=*}"
    local val="${1#*=}"
    # Detect numeric vs string
    if [[ "$val" =~ ^[0-9]+$ ]]; then
      stage_json=$(echo "$stage_json" | jq --arg k "$key" --argjson v "$val" '. + {($k): $v}')
    elif [[ "$val" == "true" || "$val" == "false" ]]; then
      stage_json=$(echo "$stage_json" | jq --arg k "$key" --argjson v "$val" '. + {($k): $v}')
    elif [[ "$val" == "null" ]]; then
      stage_json=$(echo "$stage_json" | jq --arg k "$key" '. + {($k): null}')
    else
      stage_json=$(echo "$stage_json" | jq --arg k "$key" --arg v "$val" '. + {($k): $v}')
    fi
    shift
  done
  jq --arg s "$stage" --argjson obj "$stage_json" '.stages[$s] = (.stages[$s] // {}) + $obj' "$tmp" > "$REPORT_FILE"
  rm -f "$tmp"
}

update_top_level() {
  local key="$1" val="$2"
  local tmp
  tmp=$(mktemp)
  cp "$REPORT_FILE" "$tmp"
  if [[ "$val" =~ ^[0-9]+$ ]]; then
    jq --arg k "$key" --argjson v "$val" '.[$k] = $v' "$tmp" > "$REPORT_FILE"
  else
    jq --arg k "$key" --arg v "$val" '.[$k] = $v' "$tmp" > "$REPORT_FILE"
  fi
  rm -f "$tmp"
}

compute_elapsed() {
  local start_ts="$1" end_ts="$2"
  local start_epoch end_epoch
  start_epoch=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$start_ts" "+%s" 2>/dev/null || date -d "$start_ts" "+%s")
  end_epoch=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$end_ts" "+%s" 2>/dev/null || date -d "$end_ts" "+%s")
  echo $(( end_epoch - start_epoch ))
}

now_iso() {
  date -u "+%Y-%m-%dT%H:%M:%SZ"
}

# ─── Core: Display ──────────────────────────────────────────────────

log_stage() {
  local stage="$1" status="$2" detail="$3"
  local icon
  case "$status" in
    pass)    icon="${GREEN}✓${NC}" ;;
    fail)    icon="${RED}✗${NC}" ;;
    timeout) icon="${YELLOW}⏱${NC}" ;;
    waiting) icon="${CYAN}…${NC}" ;;
    *)       icon="?" ;;
  esac
  echo -e "  ${icon} ${BOLD}${stage}${NC}: ${detail}"
}

print_summary() {
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Self-Healing Drill Report${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""
  jq -r '
    "  Drill ID:    \(.drill_id)",
    "  Type:        \(.drill_type)",
    "  Commit:      \(.injected_commit)",
    "  Signature:   \(.failure_signature // "unknown")",
    "  Dispatch:    \(.dispatch_workflow // "unknown")",
    "",
    "  Stages:",
    (.stages | to_entries[] |
      "    \(.key): \(.value.status // "pending") \(
        if .value.elapsed_from_previous_s then
          "(\(.value.elapsed_from_previous_s)s / \(.value.sla_s)s SLA)"
        else "" end
      ) \(.value.url // "")"
    ),
    "",
    "  Verdict:     \(.verdict)",
    (if .failure_reason then "  Reason:      \(.failure_reason)" else "" end),
    (if .total_elapsed_s then "  Total time:  \(.total_elapsed_s)s" else "" end)
  ' "$REPORT_FILE"
  echo ""
}

compute_verdict() {
  local verdict="PASS"
  local reason=""

  # Check all stages passed
  local failed
  failed=$(jq -r '.stages | to_entries[] | select(.value.status != "pass") | .key' "$REPORT_FILE")
  if [ -n "$failed" ]; then
    verdict="FAIL"
    reason="Stages not passing: $(echo "$failed" | tr '\n' ', ' | sed 's/,$//')"
  fi

  # Check dispatch path
  local dispatch_path
  dispatch_path=$(jq -r '.stages.auto_dispatch.dispatch_path // "unknown"' "$REPORT_FILE")
  if [ "$dispatch_path" != "Auto-Dispatch Pipeline Issues" ] && [ "$verdict" = "PASS" ]; then
    verdict="FAIL"
    reason="Dispatch came from $dispatch_path, not Auto-Dispatch Pipeline Issues"
  fi

  # Check auto-merge evidence
  local auto_merge_enabled
  auto_merge_enabled=$(jq -r '.stages.auto_merge.auto_merge_enabled // "false"' "$REPORT_FILE")
  if [ "$auto_merge_enabled" != "true" ] && [ "$verdict" = "PASS" ]; then
    verdict="FAIL"
    reason="auto_merge was not enabled before merge"
  fi

  update_top_level "verdict" "$verdict"
  if [ -n "$reason" ]; then
    update_top_level "failure_reason" "$reason"
  fi
}

# ─── Finders: GitHub API queries for each stage ─────────────────────

find_ci_failure() {
  local commit="$1"
  # Look for failing Deploy to Azure or .NET CI run for this commit
  local result
  result=$(gh api "repos/$REPO/actions/runs?head_sha=$commit&per_page=20" \
    --jq '.workflow_runs[] | select(.conclusion == "failure") | select(.name == "Deploy to Azure" or .name == ".NET CI") | {run_id: .id, workflow: .name, timestamp: .updated_at, url: .html_url}' \
    2>/dev/null | head -1)
  echo "$result"
}

find_issue() {
  local commit="$1" after_ts="$2"
  # Search for [Pipeline] CI Build Failure issues created after the failure
  local result
  result=$(gh api "repos/$REPO/issues?labels=pipeline,bug&state=all&sort=created&direction=desc&per_page=20" \
    --jq --arg after "$after_ts" --arg sha "${commit:0:7}" '
      .[] | select(.title | startswith("[Pipeline] CI Build Failure")) |
      select(.created_at > $after) |
      {issue_number: .number, timestamp: .created_at, url: .html_url}
    ' 2>/dev/null | head -1)
  echo "$result"
}

find_dispatch() {
  local issue_number="$1" after_ts="$2"
  # Look for Auto-Dispatch Pipeline Issues run after issue creation
  local result
  result=$(gh api "repos/$REPO/actions/runs?per_page=50" \
    --jq --arg after "$after_ts" '
      .workflow_runs[] |
      select(.name == "Auto-Dispatch Pipeline Issues") |
      select(.created_at > $after) |
      select(.conclusion == "success" or .status == "in_progress" or .status == "queued") |
      {run_id: .id, dispatch_path: .name, timestamp: .created_at, url: .html_url}
    ' 2>/dev/null | head -1)

  # If not found via auto-dispatch, check if watchdog picked it up
  if [ -z "$result" ]; then
    result=$(gh api "repos/$REPO/actions/runs?per_page=50" \
      --jq --arg after "$after_ts" '
        .workflow_runs[] |
        select(.name == "Pipeline Watchdog") |
        select(.created_at > $after) |
        select(.conclusion == "success") |
        {run_id: .id, dispatch_path: "Pipeline Watchdog", timestamp: .created_at, url: .html_url}
      ' 2>/dev/null | head -1)
  fi
  echo "$result"
}

find_repair_pr() {
  local issue_number="$1"
  # Find PR that references the issue
  local result
  result=$(gh api "repos/$REPO/pulls?state=all&sort=created&direction=desc&per_page=20" \
    --jq --arg inum "$issue_number" '
      .[] | select(.body != null) |
      select(.body | test("(Closes|Fixes|Resolves) #" + $inum + "\\b")) |
      {pr_number: .number, timestamp: .created_at, url: .html_url, head_sha: .head.sha}
    ' 2>/dev/null | head -1)
  echo "$result"
}

find_ci_green() {
  local pr_number="$1"
  # Get the PR head SHA, then find a successful CI run
  local head_sha
  head_sha=$(gh api "repos/$REPO/pulls/$pr_number" --jq '.head.sha' 2>/dev/null)
  if [ -z "$head_sha" ]; then
    echo ""
    return
  fi
  local result
  result=$(gh api "repos/$REPO/actions/runs?head_sha=$head_sha&per_page=20" \
    --jq '.workflow_runs[] | select(.conclusion == "success") | select(.name == ".NET CI" or .name == "Deploy to Azure") | {run_id: .id, timestamp: .updated_at, url: .html_url}' \
    2>/dev/null | head -1)
  echo "$result"
}

find_merge() {
  local pr_number="$1"
  local result
  result=$(gh api "repos/$REPO/pulls/$pr_number" \
    --jq '{
      merged: .merged,
      merge_commit: .merge_commit_sha,
      merged_by: .merged_by.login,
      auto_merge_enabled: (.auto_merge != null),
      timestamp: .merged_at,
      url: .html_url
    }' 2>/dev/null)
  echo "$result"
}

find_main_recovery() {
  local merge_commit="$1"
  # Find successful Deploy to Azure on the merge commit
  local result
  result=$(gh api "repos/$REPO/actions/runs?head_sha=$merge_commit&per_page=10" \
    --jq '.workflow_runs[] | select(.name == "Deploy to Azure") | select(.conclusion == "success") | {run_id: .id, timestamp: .updated_at, url: .html_url}' \
    2>/dev/null | head -1)
  echo "$result"
}

# ─── Injection ───────────────────────────────────────────────────────

inject_fault() {
  local drill_id="$1"

  if [ ! -f "$CANARY_FILE" ]; then
    echo -e "${RED}Error: Canary file not found at $CANARY_FILE${NC}" >&2
    exit 2
  fi

  # Inject a missing semicolon — guaranteed CS1002
  cat > "$CANARY_FILE" << 'CANARY_EOF'
namespace TicketDeflection.Canary;

/// <summary>
/// Canary class for self-healing drill suite.
/// DRILL INJECTED FAULT — missing semicolon below.
/// </summary>
public static class DrillCanary
{
    public static string Status() => "broken"
}
CANARY_EOF

  cd "$REPO_ROOT"
  git add "$CANARY_FILE"
  git commit -m "drill(main_build_syntax): inject deliberate build failure [drill-id:$drill_id]"
  if ! git push origin main; then
    echo -e "${RED}Error: Failed to push to origin/main${NC}" >&2
    exit 2
  fi

  local commit
  commit=$(git rev-parse HEAD)
  echo "$commit"
}

# ─── Poll Loop ───────────────────────────────────────────────────────

poll_until() {
  # poll_until <finder_function> <finder_args...> <max_wait_s>
  # Returns the finder result when non-empty, or empty string on timeout
  local finder="$1"
  shift
  local max_wait="${!#}"  # last argument
  local args=("${@:1:$#-1}")  # all but last

  local elapsed=0
  while [ $elapsed -lt "$max_wait" ]; do
    local result
    result=$("$finder" "${args[@]}")
    if [ -n "$result" ]; then
      echo "$result"
      return 0
    fi
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    echo -ne "\r  ${CYAN}…${NC} Polling ${finder#find_}... (${elapsed}s / ${max_wait}s)    " >&2
  done
  echo -ne "\r" >&2
  echo ""
  return 1
}

# ─── Audit Mode ──────────────────────────────────────────────────────

run_audit() {
  local commit="$1"
  local drill_id
  drill_id=$(date -u "+%Y%m%d-%H%M%S")

  echo -e "${BOLD}Auditing commit ${commit:0:7}...${NC}"
  echo ""

  init_report "$drill_id" "main_build_syntax" "$commit"

  # Stage 1: CI failure
  local ci_fail
  ci_fail=$(find_ci_failure "$commit")
  if [ -n "$ci_fail" ]; then
    local ts workflow run_id url
    ts=$(echo "$ci_fail" | jq -r '.timestamp')
    workflow=$(echo "$ci_fail" | jq -r '.workflow')
    run_id=$(echo "$ci_fail" | jq -r '.run_id')
    url=$(echo "$ci_fail" | jq -r '.url')
    update_stage "ci_failure" "status=pass" "timestamp=$ts" "workflow=$workflow" "run_id=$run_id" "url=$url"
    log_stage "ci_failure" "pass" "$workflow failed at $ts"
  else
    update_stage "ci_failure" "status=fail"
    log_stage "ci_failure" "fail" "No failing CI run found for commit"
    compute_verdict
    print_summary
    return 1
  fi

  # Stage 2: Issue created
  local ci_ts
  ci_ts=$(echo "$ci_fail" | jq -r '.timestamp')
  local issue
  issue=$(find_issue "$commit" "$ci_ts")
  if [ -n "$issue" ]; then
    local issue_ts issue_num issue_url elapsed
    issue_ts=$(echo "$issue" | jq -r '.timestamp')
    issue_num=$(echo "$issue" | jq -r '.issue_number')
    issue_url=$(echo "$issue" | jq -r '.url')
    elapsed=$(compute_elapsed "$ci_ts" "$issue_ts")
    local status="pass"
    [ "$elapsed" -gt "$SLA_FAILURE_TO_ISSUE" ] && status="fail"
    update_stage "issue_created" "status=$status" "timestamp=$issue_ts" "issue_number=$issue_num" \
      "url=$issue_url" "elapsed_from_previous_s=$elapsed" "sla_s=$SLA_FAILURE_TO_ISSUE"
    log_stage "issue_created" "$status" "#$issue_num created (${elapsed}s / ${SLA_FAILURE_TO_ISSUE}s SLA)"
  else
    update_stage "issue_created" "status=fail"
    log_stage "issue_created" "fail" "No [Pipeline] issue found"
    compute_verdict
    print_summary
    return 1
  fi

  # Stage 3: Auto dispatch
  local issue_ts_val
  issue_ts_val=$(echo "$issue" | jq -r '.timestamp')
  local issue_num_val
  issue_num_val=$(echo "$issue" | jq -r '.issue_number')
  local dispatch
  dispatch=$(find_dispatch "$issue_num_val" "$issue_ts_val")
  if [ -n "$dispatch" ]; then
    local dispatch_ts dispatch_run dispatch_path dispatch_url d_elapsed
    dispatch_ts=$(echo "$dispatch" | jq -r '.timestamp')
    dispatch_run=$(echo "$dispatch" | jq -r '.run_id')
    dispatch_path=$(echo "$dispatch" | jq -r '.dispatch_path')
    dispatch_url=$(echo "$dispatch" | jq -r '.url')
    d_elapsed=$(compute_elapsed "$issue_ts_val" "$dispatch_ts")
    local d_status="pass"
    [ "$d_elapsed" -gt "$SLA_ISSUE_TO_DISPATCH" ] && d_status="fail"
    [ "$dispatch_path" != "Auto-Dispatch Pipeline Issues" ] && d_status="fail"
    update_stage "auto_dispatch" "status=$d_status" "timestamp=$dispatch_ts" "run_id=$dispatch_run" \
      "dispatch_path=$dispatch_path" "url=$dispatch_url" "elapsed_from_previous_s=$d_elapsed" "sla_s=$SLA_ISSUE_TO_DISPATCH"
    update_top_level "dispatch_workflow" "$dispatch_path"
    log_stage "auto_dispatch" "$d_status" "$dispatch_path (${d_elapsed}s / ${SLA_ISSUE_TO_DISPATCH}s SLA)"
  else
    update_stage "auto_dispatch" "status=fail"
    log_stage "auto_dispatch" "fail" "No dispatch run found"
  fi

  # Stage 4: Repair PR
  local pr
  pr=$(find_repair_pr "$issue_num_val")
  if [ -n "$pr" ]; then
    local pr_ts pr_num pr_url pr_elapsed
    pr_ts=$(echo "$pr" | jq -r '.timestamp')
    pr_num=$(echo "$pr" | jq -r '.pr_number')
    pr_url=$(echo "$pr" | jq -r '.url')
    local dispatch_ts_val
    dispatch_ts_val=$(jq -r '.stages.auto_dispatch.timestamp // .stages.issue_created.timestamp' "$REPORT_FILE")
    pr_elapsed=$(compute_elapsed "$dispatch_ts_val" "$pr_ts")
    local pr_status="pass"
    [ "$pr_elapsed" -gt "$SLA_DISPATCH_TO_PR" ] && pr_status="fail"
    update_stage "repair_pr" "status=$pr_status" "timestamp=$pr_ts" "pr_number=$pr_num" \
      "url=$pr_url" "elapsed_from_previous_s=$pr_elapsed" "sla_s=$SLA_DISPATCH_TO_PR"
    log_stage "repair_pr" "$pr_status" "PR #$pr_num (${pr_elapsed}s / ${SLA_DISPATCH_TO_PR}s SLA)"
  else
    update_stage "repair_pr" "status=fail"
    log_stage "repair_pr" "fail" "No repair PR found"
    compute_verdict
    print_summary
    return 1
  fi

  # Stage 5: CI green on PR
  local pr_num_val
  pr_num_val=$(echo "$pr" | jq -r '.pr_number')
  local ci_green
  ci_green=$(find_ci_green "$pr_num_val")
  if [ -n "$ci_green" ]; then
    local green_ts green_run green_url green_elapsed
    green_ts=$(echo "$ci_green" | jq -r '.timestamp')
    green_run=$(echo "$ci_green" | jq -r '.run_id')
    green_url=$(echo "$ci_green" | jq -r '.url')
    local pr_ts_val
    pr_ts_val=$(echo "$pr" | jq -r '.timestamp')
    green_elapsed=$(compute_elapsed "$pr_ts_val" "$green_ts")
    local green_status="pass"
    [ "$green_elapsed" -gt "$SLA_PR_TO_GREEN" ] && green_status="fail"
    update_stage "ci_green" "status=$green_status" "timestamp=$green_ts" "run_id=$green_run" \
      "url=$green_url" "elapsed_from_previous_s=$green_elapsed" "sla_s=$SLA_PR_TO_GREEN"
    log_stage "ci_green" "$green_status" "CI passed (${green_elapsed}s / ${SLA_PR_TO_GREEN}s SLA)"
  else
    update_stage "ci_green" "status=fail"
    log_stage "ci_green" "fail" "No green CI run on PR"
  fi

  # Stage 6: Auto merge
  local merge
  merge=$(find_merge "$pr_num_val")
  if [ -n "$merge" ]; then
    local merged merged_by merge_commit auto_merge_enabled merge_ts merge_url
    merged=$(echo "$merge" | jq -r '.merged')
    if [ "$merged" = "true" ]; then
      merged_by=$(echo "$merge" | jq -r '.merged_by')
      merge_commit=$(echo "$merge" | jq -r '.merge_commit')
      auto_merge_enabled=$(echo "$merge" | jq -r '.auto_merge_enabled')
      merge_ts=$(echo "$merge" | jq -r '.timestamp')
      merge_url=$(echo "$merge" | jq -r '.url')
      local green_ts_val merge_elapsed merge_status
      green_ts_val=$(jq -r '.stages.ci_green.timestamp // .stages.repair_pr.timestamp' "$REPORT_FILE")
      merge_elapsed=$(compute_elapsed "$green_ts_val" "$merge_ts")
      merge_status="pass"
      [ "$merge_elapsed" -gt "$SLA_GREEN_TO_MERGE" ] && merge_status="fail"
      update_stage "auto_merge" "status=$merge_status" "timestamp=$merge_ts" \
        "merge_commit=$merge_commit" "merged_by=$merged_by" "auto_merge_enabled=$auto_merge_enabled" \
        "url=$merge_url" "elapsed_from_previous_s=$merge_elapsed" "sla_s=$SLA_GREEN_TO_MERGE"
      log_stage "auto_merge" "$merge_status" "Merged by $merged_by (${merge_elapsed}s / ${SLA_GREEN_TO_MERGE}s SLA)"

      # Stage 7: Main recovered
      local recovery
      recovery=$(find_main_recovery "$merge_commit")
      if [ -n "$recovery" ]; then
        local rec_ts rec_run rec_url rec_elapsed rec_status
        rec_ts=$(echo "$recovery" | jq -r '.timestamp')
        rec_run=$(echo "$recovery" | jq -r '.run_id')
        rec_url=$(echo "$recovery" | jq -r '.url')
        rec_elapsed=$(compute_elapsed "$merge_ts" "$rec_ts")
        rec_status="pass"
        [ "$rec_elapsed" -gt "$SLA_MERGE_TO_RECOVERY" ] && rec_status="fail"
        update_stage "main_recovered" "status=$rec_status" "timestamp=$rec_ts" "run_id=$rec_run" \
          "url=$rec_url" "elapsed_from_previous_s=$rec_elapsed" "sla_s=$SLA_MERGE_TO_RECOVERY"
        log_stage "main_recovered" "$rec_status" "Deploy green (${rec_elapsed}s / ${SLA_MERGE_TO_RECOVERY}s SLA)"

        # Compute total elapsed
        local first_ts last_ts total
        first_ts=$(jq -r '.stages.ci_failure.timestamp' "$REPORT_FILE")
        total=$(compute_elapsed "$first_ts" "$rec_ts")
        update_top_level "total_elapsed_s" "$total"
      else
        update_stage "main_recovered" "status=fail"
        log_stage "main_recovered" "fail" "No successful Deploy on merge commit"
      fi
    else
      update_stage "auto_merge" "status=fail"
      log_stage "auto_merge" "fail" "PR not yet merged"
    fi
  else
    update_stage "auto_merge" "status=fail"
    log_stage "auto_merge" "fail" "Could not fetch PR merge status"
  fi

  compute_verdict
  print_summary

  local final_verdict
  final_verdict=$(jq -r '.verdict' "$REPORT_FILE")
  [ "$final_verdict" = "PASS" ] && return 0 || return 1
}

# ─── Run Mode ────────────────────────────────────────────────────────

run_drill() {
  local drill_type="$1"

  if [ "$drill_type" != "main_build_syntax" ]; then
    echo -e "${RED}Unknown drill type: $drill_type${NC}" >&2
    echo "Available: main_build_syntax" >&2
    exit 2
  fi

  local drill_id
  drill_id=$(date -u "+%Y%m%d-%H%M%S")
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Self-Healing Drill: $drill_type${NC}"
  echo -e "${BOLD}  Drill ID: $drill_id${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""

  # Inject
  echo -e "${BOLD}Injecting fault...${NC}"
  local commit
  commit=$(inject_fault "$drill_id")
  echo -e "  Pushed ${commit:0:7} to origin/main"
  echo ""

  init_report "$drill_id" "$drill_type" "$commit"

  local drill_start
  drill_start=$(date +%s)

  # Stage 1: Wait for CI failure
  echo -e "${BOLD}Waiting for CI to fail...${NC}"
  local ci_fail
  if ci_fail=$(poll_until find_ci_failure "$commit" $((SLA_FAILURE_TO_ISSUE * 4))); then
    local ts workflow run_id url
    ts=$(echo "$ci_fail" | jq -r '.timestamp')
    workflow=$(echo "$ci_fail" | jq -r '.workflow')
    run_id=$(echo "$ci_fail" | jq -r '.run_id')
    url=$(echo "$ci_fail" | jq -r '.url')
    update_stage "ci_failure" "status=pass" "timestamp=$ts" "workflow=$workflow" "run_id=$run_id" "url=$url"
    log_stage "ci_failure" "pass" "$workflow failed at $ts"
  else
    update_stage "ci_failure" "status=timeout"
    log_stage "ci_failure" "timeout" "No CI failure detected within timeout"
    compute_verdict
    print_summary
    return 1
  fi

  # Stage 2: Wait for issue creation
  echo -e "${BOLD}Waiting for issue creation...${NC}"
  local ci_ts
  ci_ts=$(echo "$ci_fail" | jq -r '.timestamp')
  local issue
  if issue=$(poll_until find_issue "$commit" "$ci_ts" $((SLA_FAILURE_TO_ISSUE * 2))); then
    local issue_ts issue_num issue_url elapsed
    issue_ts=$(echo "$issue" | jq -r '.timestamp')
    issue_num=$(echo "$issue" | jq -r '.issue_number')
    issue_url=$(echo "$issue" | jq -r '.url')
    elapsed=$(compute_elapsed "$ci_ts" "$issue_ts")
    local status="pass"
    [ "$elapsed" -gt "$SLA_FAILURE_TO_ISSUE" ] && status="fail"
    update_stage "issue_created" "status=$status" "timestamp=$issue_ts" "issue_number=$issue_num" \
      "url=$issue_url" "elapsed_from_previous_s=$elapsed" "sla_s=$SLA_FAILURE_TO_ISSUE"
    log_stage "issue_created" "$status" "#$issue_num (${elapsed}s / ${SLA_FAILURE_TO_ISSUE}s SLA)"
  else
    update_stage "issue_created" "status=timeout"
    log_stage "issue_created" "timeout" "No issue created within timeout"
    compute_verdict
    print_summary
    return 1
  fi

  # Stage 3: Wait for auto dispatch
  echo -e "${BOLD}Waiting for auto-dispatch...${NC}"
  local issue_ts_val issue_num_val
  issue_ts_val=$(echo "$issue" | jq -r '.timestamp')
  issue_num_val=$(echo "$issue" | jq -r '.issue_number')
  local dispatch
  if dispatch=$(poll_until find_dispatch "$issue_num_val" "$issue_ts_val" $((SLA_ISSUE_TO_DISPATCH * 2))); then
    local dispatch_ts dispatch_run dispatch_path dispatch_url d_elapsed
    dispatch_ts=$(echo "$dispatch" | jq -r '.timestamp')
    dispatch_run=$(echo "$dispatch" | jq -r '.run_id')
    dispatch_path=$(echo "$dispatch" | jq -r '.dispatch_path')
    dispatch_url=$(echo "$dispatch" | jq -r '.url')
    d_elapsed=$(compute_elapsed "$issue_ts_val" "$dispatch_ts")
    local d_status="pass"
    [ "$d_elapsed" -gt "$SLA_ISSUE_TO_DISPATCH" ] && d_status="fail"
    [ "$dispatch_path" != "Auto-Dispatch Pipeline Issues" ] && d_status="fail"
    update_stage "auto_dispatch" "status=$d_status" "timestamp=$dispatch_ts" "run_id=$dispatch_run" \
      "dispatch_path=$dispatch_path" "url=$dispatch_url" "elapsed_from_previous_s=$d_elapsed" "sla_s=$SLA_ISSUE_TO_DISPATCH"
    update_top_level "dispatch_workflow" "$dispatch_path"
    log_stage "auto_dispatch" "$d_status" "$dispatch_path (${d_elapsed}s)"
  else
    update_stage "auto_dispatch" "status=timeout"
    log_stage "auto_dispatch" "timeout" "No dispatch within timeout"
  fi

  # Stage 4: Wait for repair PR
  echo -e "${BOLD}Waiting for repair PR...${NC}"
  local pr
  if pr=$(poll_until find_repair_pr "$issue_num_val" $((SLA_DISPATCH_TO_PR * 2))); then
    local pr_ts pr_num pr_url pr_elapsed
    pr_ts=$(echo "$pr" | jq -r '.timestamp')
    pr_num=$(echo "$pr" | jq -r '.pr_number')
    pr_url=$(echo "$pr" | jq -r '.url')
    local dispatch_ts_val
    dispatch_ts_val=$(jq -r '.stages.auto_dispatch.timestamp // .stages.issue_created.timestamp' "$REPORT_FILE")
    pr_elapsed=$(compute_elapsed "$dispatch_ts_val" "$pr_ts")
    local pr_status="pass"
    [ "$pr_elapsed" -gt "$SLA_DISPATCH_TO_PR" ] && pr_status="fail"
    update_stage "repair_pr" "status=$pr_status" "timestamp=$pr_ts" "pr_number=$pr_num" \
      "url=$pr_url" "elapsed_from_previous_s=$pr_elapsed" "sla_s=$SLA_DISPATCH_TO_PR"
    log_stage "repair_pr" "$pr_status" "PR #$pr_num (${pr_elapsed}s)"
  else
    update_stage "repair_pr" "status=timeout"
    log_stage "repair_pr" "timeout" "No repair PR within timeout"
    compute_verdict
    print_summary
    return 1
  fi

  # Stage 5: Wait for CI green on PR
  echo -e "${BOLD}Waiting for green CI on PR...${NC}"
  local pr_num_val
  pr_num_val=$(echo "$pr" | jq -r '.pr_number')
  local ci_green
  if ci_green=$(poll_until find_ci_green "$pr_num_val" $((SLA_PR_TO_GREEN * 2))); then
    local green_ts green_run green_url green_elapsed
    green_ts=$(echo "$ci_green" | jq -r '.timestamp')
    green_run=$(echo "$ci_green" | jq -r '.run_id')
    green_url=$(echo "$ci_green" | jq -r '.url')
    local pr_ts_val
    pr_ts_val=$(echo "$pr" | jq -r '.timestamp')
    green_elapsed=$(compute_elapsed "$pr_ts_val" "$green_ts")
    local green_status="pass"
    [ "$green_elapsed" -gt "$SLA_PR_TO_GREEN" ] && green_status="fail"
    update_stage "ci_green" "status=$green_status" "timestamp=$green_ts" "run_id=$green_run" \
      "url=$green_url" "elapsed_from_previous_s=$green_elapsed" "sla_s=$SLA_PR_TO_GREEN"
    log_stage "ci_green" "$green_status" "CI passed (${green_elapsed}s)"
  else
    update_stage "ci_green" "status=timeout"
    log_stage "ci_green" "timeout" "CI didn't go green within timeout"
  fi

  # Stage 6: Wait for auto merge
  echo -e "${BOLD}Waiting for auto-merge...${NC}"
  local merge_found=false
  local merge_wait=0
  local merge_max=$((SLA_GREEN_TO_MERGE * 2))
  while [ $merge_wait -lt $merge_max ]; do
    local merge
    merge=$(find_merge "$pr_num_val")
    if [ -n "$merge" ]; then
      local merged
      merged=$(echo "$merge" | jq -r '.merged')
      if [ "$merged" = "true" ]; then
        local merged_by merge_commit auto_merge_enabled merge_ts merge_url
        merged_by=$(echo "$merge" | jq -r '.merged_by')
        merge_commit=$(echo "$merge" | jq -r '.merge_commit')
        auto_merge_enabled=$(echo "$merge" | jq -r '.auto_merge_enabled')
        merge_ts=$(echo "$merge" | jq -r '.timestamp')
        merge_url=$(echo "$merge" | jq -r '.url')
        local green_ts_val merge_elapsed merge_status
        green_ts_val=$(jq -r '.stages.ci_green.timestamp // .stages.repair_pr.timestamp' "$REPORT_FILE")
        merge_elapsed=$(compute_elapsed "$green_ts_val" "$merge_ts")
        merge_status="pass"
        [ "$merge_elapsed" -gt "$SLA_GREEN_TO_MERGE" ] && merge_status="fail"
        update_stage "auto_merge" "status=$merge_status" "timestamp=$merge_ts" \
          "merge_commit=$merge_commit" "merged_by=$merged_by" "auto_merge_enabled=$auto_merge_enabled" \
          "url=$merge_url" "elapsed_from_previous_s=$merge_elapsed" "sla_s=$SLA_GREEN_TO_MERGE"
        log_stage "auto_merge" "$merge_status" "Merged by $merged_by (${merge_elapsed}s)"
        merge_found=true
        break
      else
        # PR exists but not yet merged — check if auto_merge is pending
        local am
        am=$(echo "$merge" | jq -r '.auto_merge_enabled')
        echo -ne "\r  ${CYAN}…${NC} PR open, auto_merge=$am, polling... (${merge_wait}s)    " >&2
      fi
    fi
    sleep "$POLL_INTERVAL"
    merge_wait=$((merge_wait + POLL_INTERVAL))
  done

  if [ "$merge_found" = false ]; then
    update_stage "auto_merge" "status=timeout"
    log_stage "auto_merge" "timeout" "PR not merged within timeout"
    compute_verdict
    print_summary
    return 1
  fi

  # Stage 7: Wait for main recovery
  echo -e "${BOLD}Waiting for main to recover...${NC}"
  local merge_commit_val
  merge_commit_val=$(jq -r '.stages.auto_merge.merge_commit' "$REPORT_FILE")
  local recovery
  if recovery=$(poll_until find_main_recovery "$merge_commit_val" $((SLA_MERGE_TO_RECOVERY * 2))); then
    local rec_ts rec_run rec_url rec_elapsed rec_status
    rec_ts=$(echo "$recovery" | jq -r '.timestamp')
    rec_run=$(echo "$recovery" | jq -r '.run_id')
    rec_url=$(echo "$recovery" | jq -r '.url')
    local merge_ts_val
    merge_ts_val=$(jq -r '.stages.auto_merge.timestamp' "$REPORT_FILE")
    rec_elapsed=$(compute_elapsed "$merge_ts_val" "$rec_ts")
    rec_status="pass"
    [ "$rec_elapsed" -gt "$SLA_MERGE_TO_RECOVERY" ] && rec_status="fail"
    update_stage "main_recovered" "status=$rec_status" "timestamp=$rec_ts" "run_id=$rec_run" \
      "url=$rec_url" "elapsed_from_previous_s=$rec_elapsed" "sla_s=$SLA_MERGE_TO_RECOVERY"
    log_stage "main_recovered" "$rec_status" "Deploy green (${rec_elapsed}s)"
  else
    update_stage "main_recovered" "status=timeout"
    log_stage "main_recovered" "timeout" "Main didn't recover within timeout"
  fi

  # Compute total elapsed
  local first_ts last_ts total
  first_ts=$(jq -r '.stages.ci_failure.timestamp' "$REPORT_FILE")
  last_ts=$(jq -r '(.stages.main_recovered.timestamp // .stages.auto_merge.timestamp // now | tostring)' "$REPORT_FILE")
  if [ "$last_ts" != "null" ] && [ -n "$last_ts" ]; then
    total=$(compute_elapsed "$first_ts" "$last_ts" 2>/dev/null || echo "")
    [ -n "$total" ] && update_top_level "total_elapsed_s" "$total"
  fi

  compute_verdict
  print_summary

  local final_verdict
  final_verdict=$(jq -r '.verdict' "$REPORT_FILE")
  [ "$final_verdict" = "PASS" ] && return 0 || return 1
}

# ─── Main ────────────────────────────────────────────────────────────

main() {
  if [ $# -lt 1 ]; then
    echo "Usage: $0 run <drill_type> | audit <commit-sha>" >&2
    exit 2
  fi

  # Check dependencies
  command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI required" >&2; exit 2; }
  command -v jq >/dev/null 2>&1 || { echo "Error: jq required" >&2; exit 2; }

  local mode="$1"
  case "$mode" in
    run)
      [ $# -lt 2 ] && { echo "Usage: $0 run <drill_type>" >&2; exit 2; }
      run_drill "$2"
      ;;
    audit)
      [ $# -lt 2 ] && { echo "Usage: $0 audit <commit-sha>" >&2; exit 2; }
      run_audit "$2"
      ;;
    *)
      echo "Unknown mode: $mode" >&2
      echo "Usage: $0 run <drill_type> | audit <commit-sha>" >&2
      exit 2
      ;;
  esac
}

main "$@"
```

**Step 2: Make it executable**

```bash
chmod +x scripts/self-healing-drill.sh
```

**Step 3: Verify the script parses without errors**

```bash
bash -n scripts/self-healing-drill.sh
```
Expected: No output (clean parse).

**Step 4: Commit**

```bash
git add scripts/self-healing-drill.sh
git commit -m "feat: add self-healing drill harness with run and audit modes"
```

---

### Task 4: Smoke test — audit the March 1 drill

Before running a live drill, validate the audit mode works by retroactively analyzing the March 1 deliberate break.

**Step 1: Run audit against the known commit**

```bash
./scripts/self-healing-drill.sh audit 4c0e4d8f062e75ff5c6bcfd512e671db29362697
```

Expected: The script should find all 7 stages and produce a JSON report. The verdict will be FAIL (because the March 1 run had manual intervention), but the report structure should be valid.

**Step 2: Inspect the JSON report**

```bash
cat drills/reports/*.json | jq .
```

Expected: Well-formed JSON with all stages populated. Fix any parsing or API issues.

**Step 3: Fix any issues found during smoke test**

Debug and fix. Common issues:
- `date` flag differences between macOS/Linux (`-jf` vs `-d`)
- `jq` filter mismatches with the actual GitHub API response shape
- Edge cases in `find_issue` time window

**Step 4: Commit fixes if any**

```bash
git add scripts/self-healing-drill.sh
git commit -m "fix: resolve audit smoke test issues in drill harness"
```

---

### Task 5: Live drill — run main_build_syntax end to end

This is the real test. The script injects a fault, pushes, and watches the pipeline heal itself.

**Step 1: Pull latest main**

```bash
git pull --rebase origin main
```

**Step 2: Run the live drill**

```bash
./scripts/self-healing-drill.sh run main_build_syntax
```

Expected output: The script prints stage-by-stage progress, then a final summary. Takes 15-45 minutes.

**Step 3: Review the report**

```bash
cat drills/reports/*.json | jq .
```

Check:
- All 7 stages have `status: "pass"`
- `dispatch_path` is `Auto-Dispatch Pipeline Issues`
- `auto_merge_enabled` is `true`
- `verdict` is `PASS`
- No stage exceeded its SLA

**Step 4: If PASS — commit the canary file and push the drill script**

```bash
git pull --rebase origin main
git push origin main
```

**Step 5: If FAIL — diagnose, fix the pipeline workflow that broke, re-run**

Use the JSON report to identify which stage failed. Fix the underlying workflow, not the drill script.

---

### Task 6: Commit everything and push

**Step 1: Final status check**

```bash
git status
git log --oneline -5
```

**Step 2: Push all commits**

```bash
git push origin main
```
