# Pipeline State — 2026-03-06 (Run 22761536859)

## Last Run
- Workflow run: 22761536859
- Date: 2026-03-06T11:31:18Z

## Run 07 — Compliance Scan Service: **AT RISK** ⚠️

### Issues Status
| Issue | Title | Status |
|-------|-------|--------|
| #340 | Add Compliance Domain Models and Enums | ✅ Merged (PR #348) |
| #341 | Extend DbContext and Add Compliance Demo Seed Data | ✅ Merged (PR #349) |
| #342 | Implement Static Compliance Rule Library | ✅ Merged (PR #350) |
| #343 | Implement Compliance Scan Engine Service | ✅ Merged (PR #351) |
| #344 | Implement Compliance API Endpoints | ✅ Merged (PR #352) |
| #345 | Create Compliance Dashboard Razor Page at /compliance | ✅ Merged (PR #353) |
| #346 | Add Compliance Link to Navigation and Landing Page | ✅ Merged (PR #354) |
| #347 | Add Tests for Compliance Scan Service | ✅ Merged (PR #355) |
| #359 | NavigationLayoutTests: Assert 4 nav items | ✅ Merged (PR #361) |
| #362 | Trim shared navigation to 4 pages | ✅ Merged (PR #363) |
| #396 | Consolidate tokenization | ✅ Merged (PR #398) |
| #399 | CI Build Failure: RunHistoryTests | ✅ Merged (PR #400) |
| **#402** | **CI Build Failure: EvidenceStrip_TotalsMatchAggregatedData** | **🔄 In Progress (PR #404 open, CI pending)** |

### Current Work
- PR #404 open on branch `repo-assist/issue-402-fix-evidencestrip-html-encoding-9f65ed4265b124fc`
- Fix: @Html.Raw(...) for TotalIssues and TotalPrs in Index.cshtml to prevent HTML-encoding of '+'

### [aw] Issues
- #364: System-managed no-op tracker (do not close)
- #395: Triaged — root cause resolved, awaiting human closure
- #401: Triaged — pre-agent transient failure, root cause (issue #402) has a fix PR, awaiting human closure

### Next Actions
1. Wait for PR #404 CI to pass and be reviewed
2. After PR #404 merges and CI is green, close issue #402
3. Close [aw] #395 and #401 (root causes resolved)
4. Archive Run 07: `scripts/archive-run.sh` to tag v7.0.0
