# Self-Healing Drill Evidence

7 drills executed between March 1-2, 2026. Each drill injects a deliberate CI
failure into `main` and measures whether the pipeline detects, diagnoses, repairs,
and recovers without human intervention.

## Pipeline Stages

Every drill tracks 7 stages: `ci_failure` → `issue_created` → `auto_dispatch` →
`repair_pr` → `ci_green` → `auto_merge` → `main_recovered`.

**FULL_PASS** = all 7 stages completed autonomously with `pass` status.

## Drill Index

| # | Report | Verdict | Duration | Stages | Notes |
|---|--------|---------|----------|--------|-------|
| Drill #1 | `20260301-175046.json` | pending | — | 0/7 | Initial harness setup; no stages executed |
| Drill #2 | `20260301-185118.json` | pending | — | 4/7 | Partial run; `auto_dispatch` trigger timing calibration |
| Drill #3 | `20260301-190635.json` | PASS_WITH_MANUAL_RESUME | 11m 28s | 7/7 | `auto_dispatch` failed; manual resume at dispatch stage, rest autonomous |
| Drill #4 | `20260301-193040.json` | PASS_WITH_MANUAL_RESUME | 26m 19s | 7/7 | `auto_dispatch` failed; longer repair cycle due to agent queue |
| Drill #5 | `20260301-200745.json` | PASS_WITH_MANUAL_RESUME | 11m 11s | 7/7 | `auto_dispatch` failed; same root cause as #3 and #4 |
| Drill #6 | `20260301-202613.json` | FULL_PASS | 11m 50s | 7/7 | First fully autonomous end-to-end pass. All 7 stages green. |
| Drill #7 | `20260302-152002.json` | FULL_PASS | 12m 10s | 7/7 | Live-polled FULL_PASS. [Issue #327](https://github.com/samuelkahessay/prd-to-prod/issues/327) → [PR #328](https://github.com/samuelkahessay/prd-to-prod/pull/328). Zero human intervention. |

## Key Evidence: Drill #7

The panel drill. Executed 2026-03-02, live-polled from start to finish.

- **Failure injected**: 15:20:07 UTC
- **Issue created**: 15:21:03 UTC (56s detection)
- **Auto-dispatch**: 15:21:33 UTC (30s routing)
- **Repair PR opened**: 15:26:24 UTC (4m 51s implementation)
- **CI green**: 15:27:08 UTC (44s verification)
- **Auto-merge**: 15:30:09 UTC (3m 01s merge gate)
- **Main recovered**: 15:32:17 UTC
- **Total**: 12m 10s, zero human intervention

Evidence chain: [Issue #327](https://github.com/samuelkahessay/prd-to-prod/issues/327) → [PR #328](https://github.com/samuelkahessay/prd-to-prod/pull/328)

## Progression

Drills #3-#5 all failed at `auto_dispatch` — the `issues:labeled` event trigger
required the fix to be deployed to the default branch before it could fire. This
was the pipeline's own CI-failure-to-issue workflow needing the same fix it was
supposed to trigger. The fix shipped between Drill #5 and Drill #6.

Drill #6 was the first FULL_PASS: all 7 stages autonomous, no manual steps.
Drill #7 reproduced the result the next day under live observation.

## Source of Truth

Raw JSON reports in this directory are the source of truth. This index is derived
from them. Do not fabricate or backfill stage timestamps.
