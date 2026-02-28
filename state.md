# Pipeline State — 2026-02-28

## Last Run
- Workflow run: 22531347419
- Date: 2026-02-28T23:30:07Z

## Current Run: Run 04 — Ticket Deflection Service (C#/.NET 10)

### Status: **COMPLETE** — All issues merged; no open PRs; no open pipeline tasks

### Issues
| Issue | Title | Status | PR |
|-------|-------|--------|----|
| #125 | Scaffold ASP.NET Core 8 Solution Structure | merged | #138 |
| #126 | Ticket Data Model & EF Core InMemory DbContext | merged | #139 |
| #127 | Ticket CRUD Minimal API Endpoints | merged | #150 |
| #128 | Ticket Classification Service & Classify Endpoint | merged | #145 |
| #129 | Knowledge Base Matching & Resolution Service | merged | #151 |
| #130 | Ticket Pipeline Orchestrator & Submit Endpoint | merged | #154 |
| #131 | Simulation Endpoint for Demo Data Generation | merged | #155 |
| #132 | Dashboard Overview Page with Metrics API | merged | #159 |
| #133 | Dashboard Ticket Feed Razor Page | merged | #161 |
| #134 | Dashboard Activity Log Razor Page | merged | #164 |
| #135 | Landing Page with Demo Run Button | merged | #167 |
| #136 | Dockerfile & Production Configuration | merged | #170 |
| #137 | Knowledge Base CRUD Endpoints & Seed Data | merged | #142 |
| #140 | Add .NET 8 CI workflow | closed/completed | — |
| #165 | CI Build Failure: CS0246 _ViewImports | merged | #166 |
| #172 | Fix CS0117: KnowledgeArticle missing CreatedAt | merged | #173 |
| #176 | Update target framework from net8.0 to net10.0 | merged | #182 |
| #185 | Upgrade NuGet packages to match net10.0 | closed/completed | — |
| #186 | Update dotnet-ci.yml to use .NET 10 SDK | closed/completed | — |
| #189 | Fix EF Core in-memory database scoping | merged | #192 |
| #190 | Auto-seed 25 demo tickets on startup | closed/completed | — |
| #191 | Redirect Run Demo button to /dashboard | closed/completed | — |
| #197 | Improve landing page visual design | merged | #198 |
| #199 | Fix demo deflection rate | merged | #200 |
| #201 | Redesign landing page with Blueprint×Terminal | closed/completed | — |
| #202 | Apply Blueprint×Terminal to Dashboard pages | merged | #204 |
| #205 | Add Run History section to landing page | merged | #206 |
| #207 | Fix demo button: each press adds 25 tickets | merged | — |
| #208 | Fix landing page stats: deflection rate hardcoded | merged | #224 |
| #209 | Fix demo button: executing... state can hang | merged | — |
| #210 | Fix dashboard charts: doughnut charts oversized | merged | — |
| #213 | Add OpenGraph meta tags and favicon | merged | — |
| #214 | Fix gh-aw link on landing page | merged/closed | — |
| #215 | Fix header repo name to link to GitHub | merged | — |
| #216 | Fix hero title: prd-to-prod link to GitHub | merged | — |
| #220 | Fix OpenGraph og:url to use correct Azure domain | merged | — |
| #225 | Add OpenGraph image for social sharing | merged | — |
| #229 | Fix demo button stuck on bfcache restore | merged | #230 |
| #231 | Static files not served — og-image.png returns 404 | merged | #232 |

### Open Items
- None. All pipeline tasks complete. Awaiting human archive run.

### Environment Notes
- NuGet restore succeeded (.NET 10.0.102 SDK installed)
- All tests pass
