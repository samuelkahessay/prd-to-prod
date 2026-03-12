# {{PROJECT_NAME}}

> Autonomous software delivery pipeline powered by [prd-to-prod](https://github.com/samuelkahessay/prd-to-prod).

## Quick Start

```bash
./setup.sh
```

## How It Works

1. Create an issue with your product requirements
2. Comment `/decompose` to break it into implementation tasks
3. The pipeline implements, reviews, and deploys autonomously
4. Human approval required for policy-sensitive changes

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Configuration

Run `./setup-verify.sh` to check your pipeline configuration status.

## Human Boundaries

The autonomous pipeline is bounded by `autonomy-policy.yml`. Humans control:
- Product intent and acceptance criteria
- Policy definitions and authority expansion
- Secrets, tokens, and kill switches
- Deployment routing and targets
