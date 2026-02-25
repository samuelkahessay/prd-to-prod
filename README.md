# Agentic Pipeline

Autonomous GitHub development pipeline powered by [gh-aw](https://github.com/github/gh-aw).

Write a PRD → AI decomposes it into issues → AI implements each issue → Draft PRs open for review.

## How It Works

1. **You write a PRD** and push it to `docs/prd/`, or paste it in an issue
2. **`/decompose`** — AI reads the PRD, creates GitHub Issues with acceptance criteria
3. **`repo-assist`** — AI picks up issues daily, writes code, opens draft PRs
4. **You review** and merge. Pipeline tracks progress via a status dashboard.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/samuelkahessay/agentic-pipeline.git
cd agentic-pipeline

# 2. Install gh-aw
gh extension install github/gh-aw

# 3. Bootstrap (creates labels, compiles workflows)
bash scripts/bootstrap.sh

# 4. Configure AI engine
gh aw secrets bootstrap

# 5. Push
git push

# 6. Test: create an issue with the sample PRD content, then comment:
#    /decompose
#
# Or trigger directly:
#    gh aw run prd-decomposer
```

## Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `prd-decomposer` | `/decompose` command | Parses PRD → creates issues |
| `repo-assist` | Daily + `/repo-assist` | Implements issues → opens PRs |
| `pipeline-status` | Daily | Updates progress dashboard |

## Requirements

- GitHub account with Copilot subscription
- GitHub CLI (`gh`) v2.0+
- `gh-aw` extension installed

## License

MIT
