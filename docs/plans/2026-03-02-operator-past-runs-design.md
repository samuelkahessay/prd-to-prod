# Operator Page: Past Runs Section

## Summary

Add a "Past Runs" section to the bottom of `/operator` that unifies two data sources into a single historical view: drill run cards (structured 7-stage repair cycles) and a flat decision trail (autonomous action audit log).

## Data Sources

### Drill Reports (`drills/reports/*.json`)
- Structured repair cycles with 7 stages: ci_failure → issue_created → auto_dispatch → repair_pr → ci_green → auto_merge → main_recovered
- Each stage has status, timestamp, elapsed time, SLA, and URL
- Top-level verdict: PASS, FAIL, PASS_WITH_MANUAL_RESUME
- ~10 files currently, gitignored

### Decision Events (`drills/decisions/*.json`)
- Individual autonomous actions (already shown in existing operator sections)
- Outcomes: acted, blocked, queued_for_human, escalated
- ~14 files currently, checked into git

## Architecture

### New Service: `IDrillReportService`

Mirrors `DecisionLedgerService` pattern:
- Reads JSON from configurable path (`DrillReports:Path`, defaults to `../drills/reports/`)
- Deserializes into C# records
- Returns sorted newest-first

### New Records

```
DrillReport: drill_id, drill_type, verdict, started_at, completed_at, failure_signature, stages (Dictionary<string, DrillStage>)
DrillStage: status, timestamp, elapsed_from_previous_s, sla_s, url
```

### Page Model Changes

`OperatorModel` gains:
- `DrillRuns: IReadOnlyList<DrillReport>` (capped at 10 most recent)
- Injected via `IDrillReportService`

## UI Design

New section below existing decision ledger grid on `/operator`:

### Drill Run Cards (top tier)
- Verdict badge: PASS (green), FAIL (red), PASS_WITH_MANUAL_RESUME (amber)
- Drill type + failure signature
- Total duration (completed_at - started_at)
- Stage count (e.g., "7/7 stages passed")
- Compact stage pipeline: abbreviated stage names, color-coded by status

### Decision Trail (bottom tier)
- Reuses existing `record` styling (badge + code-pill + summary)
- Shows all decision events in chronological order (newest first)
- Distinct from the existing "decision ledger" section which shows only 6 recent entries — this shows all

## Scope

- New: `IDrillReportService`, `DrillReportService`, drill report records
- Modified: `Operator.cshtml` (new section), `Operator.cshtml.cs` (inject service, load data)
- Modified: `Program.cs` (register `IDrillReportService`)
- New: Tests for drill report service and operator page rendering of past runs
