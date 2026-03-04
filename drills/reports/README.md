# Self-Healing Drill Evidence

8 drill reports were recorded between March 1-2, 2026. Seven are deliberate CI
failure injection attempts; one (`20260301-185947.json`) is a no-op harness
invocation captured for completeness after the repo was already clean.

## Pipeline Stages

Every repair attempt tracks 7 stages: `ci_failure` → `issue_created` → `auto_dispatch` →
`repair_pr` → `ci_green` → `auto_merge` → `main_recovered`.

## Index Labels

- `FULL_PASS` is a derived label used in this index when the raw JSON verdict is
  `PASS` and all 7 stages recorded `pass`.
- `PASS_WITH_MANUAL_RESUME` is the raw verdict used when dispatch needed a human
  resume but the downstream repair chain still completed.

## Drill Index

| # | Report | Verdict | Duration | Stages | Evidence | Notes |
|---|--------|---------|----------|--------|----------|-------|
| Drill #1 | `20260301-175046.json` | pending | — | 0/7 | — | Initial harness setup; no stage evidence recorded |
| Drill #2 | `20260301-185118.json` | pending | — | 4/7 | — | Partial run; timeout/trigger calibration before the loop could close |
| Drill #3 | `20260301-185947.json` | pending | — | 0/7 | — | No-op harness invocation against a clean tree; recorded here for completeness |
| Drill #4 | `20260301-190635.json` | PASS_WITH_MANUAL_RESUME | 11m 28s | 7/7 | [Issue #277](https://github.com/samuelkahessay/prd-to-prod/issues/277) → [PR #278](https://github.com/samuelkahessay/prd-to-prod/pull/278) | `auto_dispatch` failed; manual resume at dispatch stage, rest autonomous |
| Drill #5 | `20260301-193040.json` | PASS_WITH_MANUAL_RESUME | 26m 19s | 7/7 | [Issue #279](https://github.com/samuelkahessay/prd-to-prod/issues/279) → [PR #280](https://github.com/samuelkahessay/prd-to-prod/pull/280) | `auto_dispatch` failed; longer repair cycle due to agent queue |
| Drill #6 | `20260301-200745.json` | PASS_WITH_MANUAL_RESUME | 11m 11s | 7/7 | [Issue #281](https://github.com/samuelkahessay/prd-to-prod/issues/281) → [PR #282](https://github.com/samuelkahessay/prd-to-prod/pull/282) | Same root cause as Drill #4 and Drill #5 |
| Drill #7 | `20260301-202613.json` | FULL_PASS | 11m 50s | 7/7 | [Issue #283](https://github.com/samuelkahessay/prd-to-prod/issues/283) → [PR #284](https://github.com/samuelkahessay/prd-to-prod/pull/284) | First fully autonomous end-to-end pass |
| Drill #8 | `20260302-152002.json` | FULL_PASS | 12m 10s | 7/7 | [Issue #327](https://github.com/samuelkahessay/prd-to-prod/issues/327) → [PR #328](https://github.com/samuelkahessay/prd-to-prod/pull/328) | Live-polled end-to-end autonomous pass. Zero human intervention after the break push. |

## Key Evidence: Drill #8

The final drill. Executed 2026-03-02, live-polled from start to finish.

- **Failure injected**: 15:20:07 UTC
- **Issue created**: 15:21:03 UTC (56s detection)
- **Auto-dispatch**: 15:21:33 UTC (30s routing)
- **Repair PR opened**: 15:26:24 UTC (4m 51s implementation)
- **CI green**: 15:27:08 UTC (44s verification)
- **Auto-merge**: 15:30:09 UTC (3m 01s merge gate)
- **Main recovered**: 15:32:17 UTC
- **Total**: 12m 10s, zero human intervention after the break push

Evidence chain: [Issue #327](https://github.com/samuelkahessay/prd-to-prod/issues/327) → [PR #328](https://github.com/samuelkahessay/prd-to-prod/pull/328)

## Progression

Drill #3 is included because it produced a report file, but it was a no-op
invocation against an already-clean tree and did not create a new repair chain.

Drills #4-#6 all failed at `auto_dispatch` — the `issues:labeled` event trigger
required the fix to be deployed to the default branch before it could fire. This
was the pipeline's own CI-failure-to-issue workflow needing the same fix it was
supposed to trigger. The fix shipped between Drill #6 and Drill #7.

Drill #7 was the first FULL_PASS: all 7 stages autonomous, no manual steps.
Drill #8 reproduced the result the next day under live observation.

## Source of Truth

Raw JSON reports in this directory are the source of truth. This index is derived
from them. Do not fabricate or backfill stage timestamps.
