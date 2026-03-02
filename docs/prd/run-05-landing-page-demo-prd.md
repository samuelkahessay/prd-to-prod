# PRD: Run 05 Landing Page Demo

## Overview
Enhance the existing `prd-to-prod` ASP.NET Core application so the root landing
page becomes a true front door for the framework, not just a wrapper around the
Ticket Deflection specimen.

The current homepage already tells part of the pipeline story, but it still has
hardcoded run-history content, no replay experience, and no dedicated "Get
Started" path. This run upgrades the landing page so it reads completed run data
from `showcase/*/manifest.json` and `showcase/*/run-data.json`, renders that
data dynamically, and gives visitors a concrete path to fork the repo and run
the system themselves.

This is **Run 05** and should archive as:

- Showcase slug: `05-landing-page-demo`
- Tag: `v5.0.0`

## Run Mode
This is an **enhancement run**, not a greenfield scaffold.

- Reuse the existing `TicketDeflection.sln` solution
- Reuse the existing ASP.NET Core / Razor Pages app in `TicketDeflection/`
- Reuse the active deploy profile: `dotnet-azure`
- Do **not** replace the current stack, solution structure, or deployment model
- Do **not** create a bootstrap/scaffold issue unless absolutely required by a
  specific implementation detail

## Product Goals
- Make the homepage trustworthy by rendering showcase data from local JSON
- Add a replay experience for completed runs using captured timeline data
- Add a clear "Get Started" path for new users
- Preserve the existing specimen boundary and dashboard CTA
- Ensure the page automatically picks up Run 05 after archive, without any
  hardcoded Run 05 entry

## Current State
The existing homepage already includes:

- a strong hero with repo CTA
- a pipeline schematic explaining decomposition, implementation, review, and
  merge
- a run-history section with hardcoded rows for Runs 01-04
- a provenance section pointing people back to the public repo
- a clear specimen boundary
- a specimen section with live metrics and a `/dashboard` CTA

This run should **upgrade** that page, not replace it with a completely new
marketing site.

Preserve:

- the overall "pipeline first, specimen second" structure
- the specimen boundary and `/dashboard` CTA
- the live specimen metrics fetch

Replace or improve:

- hardcoded run rows
- hardcoded pipeline counts
- missing replay section
- missing dedicated Get Started section
- minimal footer

## Tech Stack
- **Runtime**: .NET 10 / ASP.NET Core
- **Language**: C# 13
- **UI**: Razor Pages + current CDN-loaded Tailwind approach
- **Data Source**: Static JSON files already committed in `showcase/`
- **Deployment**: Azure App Service via existing `dotnet-azure` deploy profile
- **Testing**: xUnit + `WebApplicationFactory<Program>`

## Validation Commands
- Restore: `dotnet restore TicketDeflection.sln`
- Build: `dotnet build TicketDeflection.sln --no-restore`
- Test: `dotnet test TicketDeflection.sln --no-build --verbosity normal`
- Run: `dotnet run --project TicketDeflection/TicketDeflection.csproj --urls http://localhost:5000`

## Design Constraints
- Keep the current industrial / terminal-like visual language as the baseline
  rather than switching to a generic startup-marketing aesthetic
- The landing page should feel like a public control surface for a real
  autonomous system, not a generic SaaS homepage
- The replay should emphasize legibility, chronology, and provenance over
  decorative motion
- The page must remain readable and useful on mobile as well as desktop
- All showcase and replay content must be sourced from completed local showcase
  data

## Anti-Slop Rules
- No gradient hero blobs, mesh gradients, or soft pastel backgrounds
- No generic AI-marketing copy such as "transform your workflow", "supercharge
  productivity", or "ready to get started?"
- No floating glassmorphism cards or ornamental background particles
- No animated count-up stats for issue/PR totals
- No autoplaying replay on first page load
- The replay should feel closer to an operator log, mission playback, or build
  console than a marketing animation
- Do not hide provenance behind vague labels; link directly to real runs, tags,
  PRDs, and repo assets
- Do not demote the specimen section into a tiny footer link; it remains part of
  the story, just not the lead

## Features

### Feature 1: Showcase Discovery and Data Access Layer
Create a read-only data access layer that discovers completed showcase runs from
the repo and loads both summary and detailed run data for use by the landing
page and replay UI.

**Technical Notes:**
- Read from the deployed repo content, not the GitHub API
- Treat a run as "completed" only when both `manifest.json` and `run-data.json`
  are present in the same `showcase/<NN>-<slug>/` directory
- Use `manifest.json` for lightweight listing (run metadata, issue/PR counts);
  load `run-data.json` only when a specific run's detail or replay data is
  requested — avoid loading all full run-data files on every page view
- Order runs by run number descending
- Skip malformed or incomplete entries without crashing the homepage
- Use strongly typed DTOs/models for deserialization instead of anonymous JSON
  blobs
- Keep this logic out of the Razor Page markup; it should live in dedicated
  application code

**Acceptance Criteria:**
- [ ] A dedicated service or equivalent application-layer component loads
      completed showcase runs from `showcase/*/manifest.json` and
      `showcase/*/run-data.json`
- [ ] The data layer exposes summary data for listing runs and detailed data for
      replaying a selected run
- [ ] Runs are sorted newest-first by run number
- [ ] Incomplete runs are skipped rather than rendering broken UI
- [ ] Malformed JSON does not crash the request; invalid runs are ignored and
      logged or safely skipped
- [ ] `dotnet test TicketDeflection.sln` passes with automated coverage for
      discovery, ordering, and invalid/incomplete-file handling

### Feature 2: Showcase API Endpoints
Expose the showcase data through local read-only endpoints so the landing page
can render run summaries and replay details without embedding hardcoded data in
markup.

**Technical Notes:**
- Create a dedicated endpoint mapping for showcase data
- Endpoints should read from the data access layer, not re-implement file
  parsing
- These endpoints must stay local to the app and use repo content only
- No outbound network calls, no GitHub token requirements, no runtime mutation
  of showcase files

**Acceptance Criteria:**
- [ ] `GET /api/showcase/runs` returns 200 with JSON array of completed runs
- [ ] Each run summary includes at least: run number, name, tag, tech stack,
      date, deployment URL if present, PRD path, issue count, PR total, PR
      merged count, and timeline event count derived from the length of the
      captured `timeline` array
- [ ] `GET /api/showcase/runs/{number}` returns 200 with detailed JSON for a
      completed run or 404 if the run is not available
- [ ] Detailed JSON includes enough data to power replay: timeline events, stats,
      issues, pull requests, and run metadata
- [ ] Endpoint responses are derived from local showcase files, not hardcoded
      values
- [ ] `dotnet test TicketDeflection.sln` passes with integration tests for the
      summary and detail endpoints

### Feature 3: Data-Driven Run History and Showcase Grid
Replace the hardcoded run-history section on `/` with a data-driven showcase
section rendered from the local showcase dataset.

**Technical Notes:**
- Update the existing landing page at `TicketDeflection/Pages/Index.cshtml`
- Preserve the current visual direction where practical, but remove hardcoded
  run rows and hardcoded aggregate counts
- The pipeline schematic section currently shows hardcoded stage counts (e.g.
  "13 issues created", "13 PRs opened") tied to a single run; update these to
  reflect aggregate totals across all discovered completed runs, or make the
  schematic count-free if aggregation adds too much complexity
- Render only completed runs discovered from showcase data
- The UI should automatically include future runs that are later archived into
  `showcase/`
- Do not hardcode Run 05 into the page
- The showcase section should read like a build manifest or completed-runs
  ledger, not a glossy marketing carousel

**Acceptance Criteria:**
- [ ] The landing page no longer hardcodes run names, issue counts, PR counts,
      or status text for individual runs
- [ ] The completed runs section is rendered from showcase data discovered at
      runtime
- [ ] Each run card or row displays actual data for: name, stack, tag, issues,
      pull requests, and deployment/tag link
- [ ] If a run has a deployment URL, the page links to it; otherwise it still
      renders a usable tag or repo link
- [ ] The landing page highlights the most recent completed run using data, not
      a hardcoded run number
- [ ] Existing specimen messaging remains below the pipeline story rather than
      replacing it
- [ ] `dotnet test TicketDeflection.sln` passes with landing-page tests updated
      to assert data-driven content

### Feature 4: Pipeline Replay
Add an interactive replay section that lets visitors inspect a completed run and
step through its real issue, PR, review, and merge timeline.

**Technical Notes:**
- Replay data comes from captured `run-data.json` files only
- Default to the most recent completed run
- Support selecting any completed run returned by the showcase API
- Keep the first version simple and robust; playback clarity matters more than
  visual novelty
- A full graph visualization is not required if a timeline-based replay better
  fits the current app
- Replay interaction model:
  - run selector for choosing a completed run
  - timeline or event rail showing ordered events from the selected run
  - event detail panel showing the currently selected event and its context
  - explicit controls for play/pause, step forward, and step backward
  - replay starts paused on initial page load
- Motion should be functional and restrained; event highlighting and step
  transitions are sufficient

**Acceptance Criteria:**
- [ ] The landing page contains a dedicated replay section above the specimen
      boundary
- [ ] Visitors can switch between completed runs using a selector or equivalent
      control
- [ ] Replay starts in a paused state on the most recent completed run
- [ ] Replay includes explicit step controls so visitors can move event-by-event
      without relying on auto-play
- [ ] Replay includes a detail view for the currently selected event
- [ ] Replay UI shows timeline events derived from captured run data, including
      issue creation, PR open, review, and merge events when present
- [ ] Replay UI includes clear current-run context: run name, stack, and high
      level stats
- [ ] Replay state updates without requiring a full page reload
- [ ] No hardcoded per-run event data exists in the page markup or client-side
      script
- [ ] `dotnet test TicketDeflection.sln` passes with coverage for replay data
      loading and selected-run behavior

### Feature 5: Get Started Section and Footer
Add a dedicated onboarding section that shows new users how to fork the repo,
write a PRD, and run the pipeline. Add footer links for the repo, architecture,
`gh-aw`, license, and PRD examples/template.

**Technical Notes:**
- Keep the onboarding content concrete and action-oriented
- Prefer links to real repo assets over placeholder buttons
- It is acceptable to include a copyable starter PRD snippet or template block,
  but it must point back to the real repository workflow
- Footer links should be stable and directly useful
- Keep the tone procedural and concrete rather than aspirational or sales-like

**Acceptance Criteria:**
- [ ] The landing page contains a dedicated "Get Started" section rather than
      relying on the hero alone
- [ ] The section explains the minimum user flow: fork/clone, write PRD,
      trigger `/decompose`, monitor the run
- [ ] The page links to the GitHub repo, architecture docs, and at least one PRD
      example or template source
- [ ] The page footer includes links for architecture, `gh-aw`, and license
- [ ] The page preserves an obvious CTA to the current specimen dashboard
- [ ] `dotnet test TicketDeflection.sln` passes with landing-page tests updated
      for the new sections

### Feature 6: Landing Page Hardening and Run 05 Readiness
Harden the landing page so it behaves correctly before and after Run 05 is
archived.

**Technical Notes:**
- Before archive, Run 05 does not yet exist in `showcase/` and must not be
  hardcoded into the data-driven showcase
- After archive, Run 05 should appear automatically because it will satisfy the
  same completed-run discovery rules as Runs 01-04
- Preserve the existing specimen metrics fetch and `/dashboard` CTA
- Avoid breaking existing dashboard, metrics, or ticket-flow behavior while
  improving `/`

**Acceptance Criteria:**
- [ ] The landing page works correctly when only Runs 01-04 exist in `showcase/`
- [ ] The implementation is written so that a future `showcase/05-landing-page-demo`
      entry will appear automatically with no code change
- [ ] If showcase discovery returns zero completed runs, the landing page still
      renders a valid fallback state instead of failing
- [ ] If a specific completed run has malformed or partial data, that run is
      skipped while the rest of the landing page still renders
- [ ] The page still renders the specimen section and its dashboard CTA
- [ ] Existing metrics/dashboard functionality remains intact
- [ ] The most recent completed run is determined from discovered data rather
      than a hardcoded run number
- [ ] `dotnet test TicketDeflection.sln` passes with coverage for completed-run
      discovery and landing-page fallback behavior

## Non-Functional Requirements
- No stack change: remain on the current ASP.NET Core / Razor Pages app
- No deploy-profile change: remain on `dotnet-azure`
- No outbound GitHub API calls or runtime dependency on GitHub authentication
- Completed runs are discovered from local repo content only
- No hardcoded list of run numbers in the rendered landing page
- The landing page must remain usable on both desktop and mobile
- If showcase data is partially unavailable, the page should degrade gracefully
  instead of failing the whole request
- Existing dashboard and specimen routes must continue to work

## Out of Scope
- Rewriting the app in Next.js, React SPA, or another stack
- Changing deployment from Azure to Vercel, Docker, or another target
- Modifying GitHub workflow files as part of this product run
- Live GitHub data fetching on every page load
- User accounts, login, or hosted pipeline execution for visitors
- A full SaaS control plane for managing PRD runs
- Editing `showcase/` at runtime from the web app
- Hardcoding Run 05 into the landing page before it is archived
