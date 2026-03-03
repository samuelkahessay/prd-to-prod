# Run 05 — Compliance Scan Service

**PRD**: [docs/prd/run-07-compliance-scan-service-prd.md](../../docs/prd/run-07-compliance-scan-service-prd.md)
**Tag**: [`v5.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v5.0.0)
**Deployment**: [prd-to-prod.azurewebsites.net/compliance](https://prd-to-prod.azurewebsites.net/compliance)
**Date**: March 2026

## Summary

A Canadian regulatory compliance scanner that classifies PIPEDA and FINTRAC
violations in freetext, code, diffs, and logs. The service auto-blocks clear
violations, issues advisories for low-risk patterns, and escalates ambiguous
findings to a human operator. The human boundary is structural:
`HUMAN_REQUIRED` response payloads omit the remediation field entirely — it
does not exist in the schema. This is the submission specimen for the
Wealthsimple AI Builder application.

## Tech Stack

ASP.NET Core (.NET 10), C#, Razor Pages, Azure App Service

## Stats

| Metric | Value |
|--------|-------|
| Issues created | 8 |
| PRs merged | 8 |
| Dispositions | `AUTO_BLOCK`, `HUMAN_REQUIRED`, `ADVISORY` |
| Frameworks scanned | PIPEDA, FINTRAC |
| Content types | `FREETEXT`, `CODE`, `DIFF`, `LOG` |
| Deployment | Azure App Service (live) |

## Issues

| Issue | Feature |
|-------|---------|
| [#340](https://github.com/samuelkahessay/prd-to-prod/issues/340) | Compliance scan API endpoint |
| [#341](https://github.com/samuelkahessay/prd-to-prod/issues/341) | PIPEDA violation patterns |
| [#342](https://github.com/samuelkahessay/prd-to-prod/issues/342) | FINTRAC violation patterns |
| [#343](https://github.com/samuelkahessay/prd-to-prod/issues/343) | Disposition classification logic |
| [#344](https://github.com/samuelkahessay/prd-to-prod/issues/344) | Compliance dashboard UI |
| [#345](https://github.com/samuelkahessay/prd-to-prod/issues/345) | Scan history and metrics |
| [#346](https://github.com/samuelkahessay/prd-to-prod/issues/346) | Human decision recording endpoint |
| [#347](https://github.com/samuelkahessay/prd-to-prod/issues/347) | Simulation mode with sample violations |

## Pull Requests

| PR | What it shipped |
|----|----------------|
| [#348](https://github.com/samuelkahessay/prd-to-prod/pull/348) | Compliance scan API endpoint |
| [#349](https://github.com/samuelkahessay/prd-to-prod/pull/349) | PIPEDA violation patterns |
| [#350](https://github.com/samuelkahessay/prd-to-prod/pull/350) | FINTRAC violation patterns |
| [#351](https://github.com/samuelkahessay/prd-to-prod/pull/351) | Disposition classification logic |
| [#352](https://github.com/samuelkahessay/prd-to-prod/pull/352) | Compliance dashboard UI |
| [#353](https://github.com/samuelkahessay/prd-to-prod/pull/353) | Scan history and metrics |
| [#354](https://github.com/samuelkahessay/prd-to-prod/pull/354) | Human decision recording endpoint |
| [#355](https://github.com/samuelkahessay/prd-to-prod/pull/355) | Simulation mode with sample violations |

## Human/AI Boundary

The compliance scanner classifies content but does not determine remediation for
escalated findings. When a finding is classified as `HUMAN_REQUIRED`, the
response schema omits the remediation field — the field does not exist, not as
null but as absent. This boundary is structural, not advisory.

The reasoning: getting it wrong under PIPEDA or the Proceeds of Crime Act has
legal consequences. The AI classifies and stops. A human decides.

## Restore Code

```bash
git checkout v5.0.0 -- TicketDeflection/ TicketDeflection.sln
dotnet build
dotnet run --project TicketDeflection
```
