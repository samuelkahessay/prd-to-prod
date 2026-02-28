# Pipeline State — 2026-02-28

## Last Run
- Workflow run: 22514192430
- Date: 2026-02-28T05:22:54Z

## Current Run: Run 04 — Ticket Deflection Service (C#/.NET 10)

### Status: **ON_TRACK** — 3 new PRs opened for issues #209, #210, #213

### Issues
| Issue | Title | Deps | Status | PR |
|-------|-------|------|--------|----|
| #125 | Scaffold ASP.NET Core 8 Solution Structure | None | merged | #138 |
| #126 | Ticket Data Model & EF Core InMemory DbContext | #125 | merged | #139 |
| #127 | Ticket CRUD Minimal API Endpoints | #126 | merged | #150 |
| #128 | Ticket Classification Service & Classify Endpoint | #126 | merged | #145 |
| #129 | Knowledge Base Matching & Resolution Service | #128,#137 | merged | #151 |
| #130 | Ticket Pipeline Orchestrator & Submit Endpoint | #128,#129 | merged | #154 |
| #131 | Simulation Endpoint for Demo Data Generation | #130 | merged | #155 |
| #132 | Dashboard Overview Page with Metrics API | #130 | merged | #159 |
| #133 | Dashboard Ticket Feed Razor Page | #132 | merged | #161 |
| #134 | Dashboard Activity Log Razor Page | #132 | merged | #164 |
| #135 | Landing Page with Demo Run Button | #131,#133,#134 | merged | #167 |
| #136 | Dockerfile & Production Configuration | #135 | merged | #170 |
| #137 | Knowledge Base CRUD Endpoints & Seed Data | None | merged | #142 |
| #140 | Add .NET 8 CI workflow | None | closed/completed | — |
| #165 | CI Build Failure: CS0246 _ViewImports | None | merged | #166 |
| #172 | Fix CS0117: KnowledgeArticle missing CreatedAt | None | merged | #173 |
| #176 | Update target framework from net8.0 to net10.0 | None | merged | #182 |
| #185 | Upgrade NuGet packages to match net10.0 | None | closed/completed | — |
| #186 | Update dotnet-ci.yml to use .NET 10 SDK | #185 | closed/completed | — |
| #189 | Fix EF Core in-memory database scoping in test fixtures | None | merged | #192 |
| #190 | Auto-seed 25 demo tickets on startup for cold-start dashboard | None | closed/completed | — |
| #191 | Redirect Run Demo button to /dashboard after simulation | #190 | closed/completed | — |
| #197 | Improve landing page visual design and demo flow | None | merged | #198 |
| #199 | Fix demo deflection rate: tune seed tickets and lower matching threshold | None | merged | #200 |
| #201 | Redesign landing page with Blueprint×Terminal aesthetic | None | closed/completed | — |
| #202 | Apply Blueprint×Terminal to Dashboard/Tickets/Activity pages | #201 | merged | #204 |
| #205 | Add Run History section to landing page | #201 | merged | #206 |
| #209 | Fix demo button: executing... state can hang indefinitely | None | **in-progress** | PR opened (branch repo-assist/issue-209-demo-btn-timeout) |
| #210 | Fix dashboard charts: doughnut charts oversized | None | **in-progress** | PR opened (branch repo-assist/issue-210-dashboard-charts-sizing) |
| #211 | Add OpenGraph meta tags to landing page | None | closed/not_planned | superseded by #213 |
| #212 | Add favicon to all pages | None | closed/not_planned | superseded by #213 |
| #213 | Add OpenGraph meta tags and favicon for social sharing | None | **in-progress** | PR opened (branch repo-assist/issue-213-og-tags-favicon) |

### Open Items
- #209: Fix demo button timeout → PR opened, awaiting review
- #210: Fix dashboard charts sizing → PR opened, awaiting review
- #213: Add OG tags and favicon → PR opened, awaiting review

### Environment Notes
- NuGet restore succeeded (.NET 10.0.102 SDK installed)
- GH_AW_GITHUB_TOKEN can push branches / create PRs
- All 62 tests pass after changes
