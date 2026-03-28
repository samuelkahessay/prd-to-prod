# {{PROJECT_NAME}}

> Autonomous software delivery pipeline powered by [prd-to-prod](https://github.com/samuelkahessay/prd-to-prod).

## Quick Start

```bash
./setup.sh
```

The default `nextjs-vercel` scaffold ships the web app in `web/`. Start feature
work there unless your PRD explicitly changes the app foundation.

## How It Works

1. Create an issue with your product requirements
2. Comment `/decompose` to break it into implementation tasks
3. The pipeline implements and reviews autonomously
4. Deployment validation runs when deployment credentials are configured
5. Human approval required for policy-sensitive changes

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Configuration

Run `./setup-verify.sh` to check your pipeline configuration status.

## Local Validation

Run `bash scripts/validate-implementation.sh` before opening or reviewing implementation PRs. Decomposed issues may add extra checks under `## Required Validation`; treat those as part of the contract for that issue.

## Human Boundaries

The autonomous pipeline is bounded by `autonomy-policy.yml`. Humans control:
- Product intent and acceptance criteria
- Policy definitions and authority expansion
- Secrets, tokens, and kill switches
- Deployment routing and targets
