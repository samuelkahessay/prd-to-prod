# PRD to Prod

Send a PRD, get a deployed app. Autonomous agents build, review, and deploy
your app from a product spec. You get a live URL, a real repo with CI/CD, and
code you own.

Open source. MIT licensed. Powered by [gh-aw](https://github.com/github/gh-aw)
(GitHub Agentic Workflows).

**[prd-to-prod.vercel.app](https://prd-to-prod.vercel.app)**

## How it works

1. You write a product spec as a GitHub issue.
2. `prd-decomposer` breaks it into ordered sub-issues with acceptance criteria.
3. `repo-assist` picks up each issue, writes the code, and opens a PR.
4. `pr-review-agent` reviews the diff against the spec and policy.
5. `pr-review-submit` merges if everything passes, or stops and flags a human.
6. `deploy-router` ships to production. If CI breaks, the system fixes it — or escalates.

Every step is visible in GitHub: issues, PRs, reviews, and workflow runs.

## Use it

### We run it for you

Send a PRD through the [landing page](https://prd-to-prod.vercel.app). All LLM
compute included. First run free.

| Complexity | Price |
|---|---|
| Simple app / internal tool | $99 |
| Multi-feature with integrations | $249 |
| Complex (auth, multiple APIs) | $499 |

### Run it yourself

The code is MIT. Fork it, bring your own LLM (Copilot, Claude, Codex, Gemini),
deploy anywhere.

```bash
git clone https://github.com/samuelkahessay/prd-to-prod.git
cd prd-to-prod

gh extension install github/gh-aw
bash scripts/bootstrap.sh
gh aw secrets bootstrap
git push
```

Then create an issue with your product spec and comment `/decompose`.

**You'll need:** a GitHub repo with Actions, an LLM license (~$19/mo), and
hosting (Vercel free tier works). Optional support available at $299/mo.

## What humans own vs. what AI does

| Humans decide | AI handles |
|---|---|
| What to build (specs, acceptance criteria) | Breaking specs into tasks, writing code, reviewing PRs |
| What the system is allowed to do ([`autonomy-policy.yml`](autonomy-policy.yml)) | Merging safe changes, fixing CI failures |
| Workflow rules, secrets, deploy config, branch protection | Everything else inside those guardrails |

If the system encounters something not covered by policy, it stops and asks a human.

## Agents

| Agent | What it does |
|---|---|
| **Repo Assist** | Implements issues and opens PRs |
| **Frontend Agent** | Handles visual/UI issues with design-aware review |
| **PR Review Agent** | Reviews diffs against the spec |
| **PRD Decomposer** | Splits a spec into ordered sub-issues |
| **PRD Architecture Planner** | Creates an implementation plan before coding starts |
| **CI Failure Doctor** | Diagnoses failed CI runs |
| **Code Simplifier** | Proposes cleanup PRs |
| **Duplicate Code Detector** | Finds and refactors duplication |
| **Security Compliance Campaign** | Fixes critical vulnerabilities |
| **Pipeline Status Report** | Maintains a rolling status dashboard |

Supporting workflows handle dispatch, review verdicts, CI failure routing,
stale work cleanup, and deploy target selection.

## What's been built with it

Everything below was built by the pipeline — not hand-coded. Running it against
real work also produced 31 upstream findings and 17 bug fixes merged into
[gh-aw](https://github.com/github/gh-aw).

| Run | App | Stack |
|---|---|---|
| 01 | [Code Snippet Manager](showcase/01-code-snippet-manager/) | Express + TypeScript |
| 02 | [Pipeline Observatory](showcase/02-pipeline-observatory/) | Next.js 14 + TypeScript |
| 03 | [DevCard](showcase/03-devcard/) | Next.js 14 + Framer Motion |
| 04 | [Ticket Deflection Service](showcase/04-ticket-deflection/) | ASP.NET Core + C# |
| 05 | [Compliance Scan Service](showcase/05-compliance-scan/) | ASP.NET Core + C# |

## Upstream contributions

The most active external contributor to gh-aw in its first month. 31 findings
cataloged, 19 issues filed, 17 fixes shipped across 7 releases, 14 credited
by name in release notes.

| Release | Fixes |
|---|---|
| [`v0.51.3`](https://github.com/github/gh-aw/releases/tag/v0.51.3) | Concurrency group collapse, malformed reference validation |
| [`v0.51.6`](https://github.com/github/gh-aw/releases/tag/v0.51.6) | JSON state collapse, auto-merge gating |
| [`v0.53.0`](https://github.com/github/gh-aw/releases/tag/v0.53.0) | Push retry/backoff, stderr leak, ENOENT noise, model flag |
| [`v0.53.3`](https://github.com/github/gh-aw/releases/tag/v0.53.3) | PR error crash, duplicate issue creation, missing labels |
| [`v0.56.1`](https://github.com/github/gh-aw/releases/tag/v0.56.1) | Safe-outputs escalation, dispatch validation, bot identity matching |

## Self-hosting reference

### Required secrets

- `GH_AW_GITHUB_TOKEN` — PAT for issue creation and auto-merge
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — for Vercel deploys

### Required repo settings

- Auto-merge enabled
- Delete branch on merge enabled
- Active `Protect main` ruleset on `main`

### Emergency controls

Set `PIPELINE_HEALING_ENABLED=false` as a repo variable to pause auto-repair.
The system still detects failures but won't dispatch fixes until re-enabled.

## Further reading

- [**Autonomy Policy**](autonomy-policy.yml) — what the system can and can't do
- [**Architecture**](docs/ARCHITECTURE.md) — how workflows and agents connect
- [**Why gh-aw**](docs/why-gh-aw.md) — why GitHub Actions is the control layer

## License

MIT
