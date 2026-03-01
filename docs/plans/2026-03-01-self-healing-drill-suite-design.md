# Self-Healing Drill Suite — Design

**Date:** 2026-03-01
**Status:** Approved
**Scope:** Tier 1 — `main_build_syntax` + `auto_merge_completion`

## Problem

The self-healing pipeline (CI failure → auto-issue → agent fix → auto-merge) has multiple moving parts across 6+ workflows. When we tested it on March 1 (commit `4c0e4d8`), the loop required manual intervention at two points. We need a repeatable, evidence-based way to prove the loop closes hands-free, and to catch regressions when workflows change.

## Solution

A local drill harness (`scripts/self-healing-drill.sh`) that injects a deterministic build failure, monitors the full repair chain via the GitHub API, and produces a structured JSON report with pass/fail verdicts against defined SLAs.

## Audience

- **Demo artifact:** Timestamped proof for stakeholders ("failure at 2:15, healed at 2:25, zero intervention")
- **Regression suite:** Run after workflow changes to verify the loop still closes
- **Development tool:** Confidence check during pipeline development

## Canary File

**Path:** `TicketDeflection/Canary/DrillCanary.cs`

A dedicated file inside the existing .NET project that always compiles under normal conditions. The drill injects a guaranteed compiler error (missing semicolon, invalid token in an initializer, or malformed method signature — not a class-name typo, which may still compile if unreferenced).

**Principles:**
- Never mutate real product code for drills
- Deterministic failure — always produces a CS-series compiler error
- Unique drill marker in the commit message for traceability
- Clean blast radius — the agent's fix is always "restore the canary file"

**Commit message format:** `drill(main_build_syntax): inject deliberate build failure [drill-id:YYYYMMDD-HHMMSS]`

## Evidence Schema

Every drill run produces a JSON report at `drills/reports/<DRILL_ID>.json`.

**Top-level fields:**

| Field | Type | Description |
|-------|------|-------------|
| `drill_id` | string | `YYYYMMDD-HHMMSS` timestamp identifier |
| `drill_type` | string | `main_build_syntax` for Tier 1 |
| `injected_commit` | string | SHA of the fault-injection commit |
| `failure_signature` | string | The compiler error string (e.g., `error CS1002`) |
| `dispatch_workflow` | string | Which workflow dispatched repair |

**Stages (each with `timestamp`, `url`, `status`, `elapsed_from_previous_s`, `sla_s`):**

1. **`ci_failure`** — Deploy to Azure or .NET CI fails on the injected commit. Fields: `run_id`, `workflow`.
2. **`issue_created`** — `[Pipeline] CI Build Failure` issue created with `bug` + `pipeline` labels. Fields: `issue_number`.
3. **`auto_dispatch`** — Auto-Dispatch Pipeline Issues workflow fires. Fields: `run_id`, `dispatch_path`. **Pass condition:** dispatch came from `Auto-Dispatch Pipeline Issues`, not `Pipeline Watchdog`.
4. **`repair_pr`** — Repo-assist opens a fix PR. Fields: `pr_number`, `repo_assist_run_id`.
5. **`ci_green`** — CI passes on the fix PR. Fields: `run_id`.
6. **`auto_merge`** — PR merges without human intervention. Fields: `merge_commit`, `merged_by`, `auto_merge_enabled` (boolean, checked before merge completes). **Pass condition:** `auto_merge_enabled` was `true` before merge. `merged_by` is supporting evidence, not the sole verdict source.
7. **`main_recovered`** — Deploy to Azure succeeds on the merge commit on main. Fields: `run_id`. This is the real "healed" signal.

**Verdict logic:**
- `PASS` — all 7 stages completed within SLA, `dispatch_path` is auto-dispatch, `auto_merge_enabled` was `true`
- `FAIL` — any stage timed out, failed SLA, or required manual intervention

## SLAs (v1)

| Stage Transition | SLA | Rationale |
|-----------------|-----|-----------|
| Failure → Issue | 2 min | Router triggers on `workflow_run`, near-instant |
| Issue → Dispatch | 2 min | 15s debounce + guard check in auto-dispatch |
| Dispatch → PR | 10 min | Agent clone + analyze + code + push |
| PR → Green CI | 15 min | .NET CI build + Deploy to Azure |
| Green → Merge | 10 min | Review agent + pr-review-submit + auto-merge |
| Merge → Main Recovered | 5 min | Deploy to Azure on main |

**Overall drill timeout:** 45 minutes.

## Script: `scripts/self-healing-drill.sh`

### Two Modes

```bash
# Mode 1: Live drill — inject fault, poll, report
./scripts/self-healing-drill.sh run main_build_syntax

# Mode 2: Retroactive audit — analyze a past drill by commit SHA
./scripts/self-healing-drill.sh audit <commit-sha>
```

### Implementation Constraints

1. **`run` and `audit` share the same finder/report/verdict code path.** `run` adds inject + poll on top. No divergent logic.
2. **JSON report is written incrementally after every stage update.** If the script crashes mid-drill, the partial report is still valid and auditable.

### Internal Functions

| Function | Purpose |
|----------|---------|
| `inject_fault()` | Mutate canary, commit with drill marker, push to main |
| `find_ci_failure()` | Find failing CI run for the injected commit SHA |
| `find_issue()` | Find `[Pipeline]` issue created after the failure |
| `find_dispatch()` | Find auto-dispatch run triggered by the issue |
| `find_repair_pr()` | Find fix PR linked to the issue |
| `find_ci_green()` | Find passing CI run on the fix PR |
| `find_merge()` | Check PR merge status, `auto_merge` field, `merged_by` |
| `find_main_recovery()` | Find passing Deploy to Azure on the merge commit |
| `poll_stage()` | Generic poller: API query + condition, 15s interval, timeout |
| `update_report()` | Write current state to JSON after each stage |
| `print_summary()` | Render Markdown table to stdout |

### Poll Behavior

- Each stage polls every 15 seconds
- Max wait per stage: 2x the SLA (as buffer)
- On timeout: record `status: "timeout"`, continue polling remaining stages
- Some downstream stages may still complete even if an upstream stage times out

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All stages passed SLAs, no manual intervention |
| `1` | At least one stage failed or timed out |
| `2` | Injection failed (push rejected, etc.) |

## File Layout

```
scripts/self-healing-drill.sh          # The harness
TicketDeflection/Canary/DrillCanary.cs # Canary file (always compiles)
drills/reports/                        # JSON reports (gitignored)
```

## Future Tiers (Not in v1)

For reference, the full drill matrix for future versions:

- **Tier 2:** `pr_build_failure`, `duplicate_main_failure`
- **Tier 3:** `stale_head_repair`, `non_pipeline_pr_failure`, `missing_linked_issue`
- **Tier 4:** `watchdog_rescue`, `secret_missing_guard`

## Dependencies

- `gh` CLI authenticated with repo access
- `jq` for JSON processing
- Push access to `main` (bypassing branch protection)
- `GH_AW_GITHUB_TOKEN` configured as a repo secret
