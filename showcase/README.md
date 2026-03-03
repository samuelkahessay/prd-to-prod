# Showcase

Each entry below is a PRD that was fed to the agentic pipeline and autonomously
implemented on the pipeline-generated path — from issue decomposition through
code review and pipeline PR merge.

These showcase runs demonstrate the autonomous path. Human-authored PRs in this
repo are still manually merged by design.

The pipeline itself lives in `.github/`, `scripts/`, and `docs/`. The
implementation code for each run is preserved at its git tag.

| Run | PRD | Tech Stack | Tag | Highlights |
|-----|-----|-----------|-----|------------|
| 01 | [Code Snippet Manager](01-code-snippet-manager/) | Express + TypeScript | [`v1.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v1.0.0) | 8 features, 7 PRs, zero human implementation code |
| 02 | [Pipeline Observatory](02-pipeline-observatory/) | Next.js 14 + TypeScript | [`v2.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v2.0.0) | 10 features, 32 tests, live deployment |
| 03 | [DevCard](03-devcard/) | Next.js 14 + TypeScript + Framer Motion | [`v3.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v3.0.0) | 17 issues, 22 PRs, 6 themes, 29 tests |
| 04 | [Ticket Deflection](04-ticket-deflection/) | ASP.NET Core + C# | [`v4.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v4.0.0) | 52 issues, 37 PRs, live Azure deployment |
| 05 | [Compliance Scan Service](05-compliance-scan/) | ASP.NET Core + C# | [`v5.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v5.0.0) | PIPEDA + FINTRAC scanner, 8 issues, 8 PRs |
