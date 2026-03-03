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

ASP.NET Core (.NET 10), C#, Razor Pages, Azure App Service

## Stats

| Metric | Value |
|--------|-------|
| Issues created | 52 |
| PRs merged | 37 |
| Deployment | Azure App Service (live) |
| Stack change | First .NET run (runs 01-03 were Node/Next.js) |

## Restore Code

```bash
git checkout v4.0.0 -- TicketDeflection/ TicketDeflection.sln
dotnet build
dotnet run --project TicketDeflection
```
