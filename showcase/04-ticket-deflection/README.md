# Run 04 — Ticket Deflection

**PRD**: [docs/prd/ticket-deflection-prd.md](../../docs/prd/ticket-deflection-prd.md)
**Tag**: [`v4.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v4.0.0)
**Deployment**: [prd-to-prod.azurewebsites.net](https://prd-to-prod.azurewebsites.net)
**Date**: February 2026

## Summary

An ASP.NET Core service that classifies and routes incoming support tickets,
deflecting common questions to automated responses while escalating complex cases
to human agents. This was the first .NET run — a full stack change from the
Node/Next.js runs 01-03 — and the largest pipeline run by issue count: 52 issues
decomposed from the PRD, 37 PRs autonomously implemented, reviewed, and merged.
Deployed to Azure.

## Tech Stack

ASP.NET Core (.NET 10), C#, Razor Pages, Entity Framework Core (InMemory),
Tailwind CSS (CDN), Chart.js (CDN), Azure App Service

## Stats

| Metric | Value |
|--------|-------|
| Issues created | 52 |
| PRs merged | 37 |
| Lines added | 3,987 |
| Lines removed | 321 |
| Files changed | 119 |
| Deployment | Azure App Service (live) |
| Stack change | First .NET run (runs 01-03 were Node/Next.js) |

## Features

13 features were decomposed from the PRD and implemented sequentially:

| Feature | Issue | PR | What it shipped |
|---------|-------|----|-----------------|
| Scaffold ASP.NET Core project | [#125](https://github.com/samuelkahessay/prd-to-prod/issues/125) | [#138](https://github.com/samuelkahessay/prd-to-prod/pull/138) | Solution structure, Minimal API routing, health endpoint |
| Ticket data model & EF Core | [#126](https://github.com/samuelkahessay/prd-to-prod/issues/126) | [#139](https://github.com/samuelkahessay/prd-to-prod/pull/139) | Entity models, enums, InMemory DbContext |
| Ticket CRUD endpoints | [#127](https://github.com/samuelkahessay/prd-to-prod/issues/127) | [#150](https://github.com/samuelkahessay/prd-to-prod/pull/150) | Five Minimal API endpoints with DTO layer |
| Classification service | [#128](https://github.com/samuelkahessay/prd-to-prod/issues/128) | [#145](https://github.com/samuelkahessay/prd-to-prod/pull/145) | Keyword-based category and severity rules |
| Knowledge base CRUD & seed | [#137](https://github.com/samuelkahessay/prd-to-prod/issues/137) | [#142](https://github.com/samuelkahessay/prd-to-prod/pull/142) | CRUD endpoints, 12+ seed articles |
| Matching & resolution | [#129](https://github.com/samuelkahessay/prd-to-prod/issues/129) | [#151](https://github.com/samuelkahessay/prd-to-prod/pull/151) | Jaccard similarity matching, auto-resolve/escalate |
| Pipeline orchestrator | [#130](https://github.com/samuelkahessay/prd-to-prod/issues/130) | [#154](https://github.com/samuelkahessay/prd-to-prod/pull/154) | Full lifecycle chain: create → classify → match → resolve |
| Simulation endpoint | [#131](https://github.com/samuelkahessay/prd-to-prod/issues/131) | [#155](https://github.com/samuelkahessay/prd-to-prod/pull/155) | Bulk demo data generation with aggregate stats |
| Dashboard overview | [#132](https://github.com/samuelkahessay/prd-to-prod/issues/132) | [#159](https://github.com/samuelkahessay/prd-to-prod/pull/159) | Metrics API, Chart.js doughnut charts |
| Ticket feed | [#133](https://github.com/samuelkahessay/prd-to-prod/issues/133) | [#161](https://github.com/samuelkahessay/prd-to-prod/pull/161) | Live feed with status badges, submit modal |
| Activity log | [#134](https://github.com/samuelkahessay/prd-to-prod/issues/134) | [#164](https://github.com/samuelkahessay/prd-to-prod/pull/164) | Chronological timeline, paginated API |
| Landing page | [#135](https://github.com/samuelkahessay/prd-to-prod/issues/135) | [#167](https://github.com/samuelkahessay/prd-to-prod/pull/167) | Architecture diagram, simulate button |
| Dockerfile & production | [#136](https://github.com/samuelkahessay/prd-to-prod/issues/136) | [#170](https://github.com/samuelkahessay/prd-to-prod/pull/170) | Multi-stage Dockerfile, production config |

## Hardening PRs

After the 13 feature PRs merged, the pipeline continued with build fixes,
framework upgrades, and UX hardening — all autonomously:

| PR | What it fixed |
|----|---------------|
| [#166](https://github.com/samuelkahessay/prd-to-prod/pull/166) | Fix Razor CS0246 build errors (missing `_ViewImports.cshtml`) |
| [#173](https://github.com/samuelkahessay/prd-to-prod/pull/173) | Fix CS0117: add `CreatedAt` to `KnowledgeArticle` model |
| [#182](https://github.com/samuelkahessay/prd-to-prod/pull/182) | Upgrade target framework from net8.0 to net10.0 |
| [#187](https://github.com/samuelkahessay/prd-to-prod/pull/187) | Upgrade NuGet packages for net10.0 compatibility |
| [#192](https://github.com/samuelkahessay/prd-to-prod/pull/192) | Fix EF Core InMemory database scoping in test fixtures |
| [#196](https://github.com/samuelkahessay/prd-to-prod/pull/196) | Fix tokenizer punctuation stripping for Jaccard matching |
| [#200](https://github.com/samuelkahessay/prd-to-prod/pull/200) | Tune seed tickets and matching threshold for ~70% deflection |
| [#203](https://github.com/samuelkahessay/prd-to-prod/pull/203) | Redesign landing page with Blueprint×Terminal aesthetic |
| [#204](https://github.com/samuelkahessay/prd-to-prod/pull/204) | Apply Blueprint×Terminal design to Dashboard, Tickets, Activity |
| [#206](https://github.com/samuelkahessay/prd-to-prod/pull/206) | Add Run History section to landing page |
| [#217](https://github.com/samuelkahessay/prd-to-prod/pull/217) | Fix demo button: add 30s timeout for executing state |
| [#218](https://github.com/samuelkahessay/prd-to-prod/pull/218) | Fix dashboard doughnut charts: constrain to 240px height |
| [#224](https://github.com/samuelkahessay/prd-to-prod/pull/224) | Fix landing page stats: compute deflection rate from live data |
| [#227](https://github.com/samuelkahessay/prd-to-prod/pull/227) | Fix demo button: clear tickets before each simulation |
| [#232](https://github.com/samuelkahessay/prd-to-prod/pull/232) | Fix static files: register `UseStaticFiles` middleware |

## Pipeline Lessons

1. **First .NET run required 6 CI workflow attempts.** The PRD was written for
   .NET 8, but the pipeline needed 6 tries ([#140](https://github.com/samuelkahessay/prd-to-prod/issues/140),
   [#144](https://github.com/samuelkahessay/prd-to-prod/issues/144),
   [#146](https://github.com/samuelkahessay/prd-to-prod/issues/146),
   [#149](https://github.com/samuelkahessay/prd-to-prod/issues/149),
   [#152](https://github.com/samuelkahessay/prd-to-prod/issues/152),
   [#153](https://github.com/samuelkahessay/prd-to-prod/issues/153))
   to produce a valid CI workflow for `dotnet build` and `dotnet test`. This
   proved the pipeline is stack-agnostic but not frictionless on first encounter
   with a new ecosystem.

2. **Framework upgrade was non-trivial.** The original PRD targeted .NET 8, but
   the deployed environment uses .NET 10. The upgrade spanned 4 issues and
   multiple PRs — NuGet package versions, SDK references in CI, and EF Core
   API changes all needed coordinated updates.

3. **EF Core InMemory scoping matters for tests.** Tests initially shared
   database state, causing intermittent failures. PR [#192](https://github.com/samuelkahessay/prd-to-prod/pull/192)
   fixed this by ensuring each test fixture uses a unique `Guid`-named database.

4. **Jaccard matching needs clean tokenization.** The matching service produced
   low confidence scores until PR [#196](https://github.com/samuelkahessay/prd-to-prod/pull/196)
   stripped punctuation before computing Jaccard similarity. A subtle bug with
   real impact on deflection rates.

5. **The agent designed a full visual language.** Without being asked, the agent
   created a "Blueprint×Terminal" design system (dark navy, cyan accents, grid
   lines, monospace type) and applied it consistently across all pages. This
   aesthetic carried forward into Run 05 and later work.

## Restore Code

```bash
git checkout v4.0.0 -- TicketDeflection/ TicketDeflection.sln
dotnet build
dotnet run --project TicketDeflection
```
