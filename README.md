# PRD to Prod

Send a PRD, get an invite-only beta run. The current public path is manual
$1 entitlement -> single-use access code -> GitHub auth -> BYOK OpenRouter key
-> private repo provisioned from the public scaffold. Runs finish at repo
handoff by default, with deployment validation when Vercel credentials are
configured.

Open source. MIT licensed. Powered by [gh-aw](https://github.com/github/gh-aw)
(GitHub Agentic Workflows).

**[prdtoprod.com](https://prdtoprod.com)**

## How it works

1. You write a product spec as a GitHub issue.
2. `prd-decomposer` breaks it into ordered sub-issues with acceptance criteria.
3. `repo-assist` picks up each issue, writes the code, and opens a PR.
4. `pr-review-agent` reviews the diff against the spec and policy.
5. `pr-review-submit` merges if everything passes, or stops and flags a human.
6. `deploy-router` ships when deployment credentials are configured. Otherwise
   the run exits cleanly at repo handoff after validation confirms there is no
   deployment URL to check.

Every step is visible in GitHub: issues, PRs, reviews, and workflow runs.

## Use it

### Invite-only beta

Request access through the [landing page](https://prd-to-prod.vercel.app).
Today, `$1` is a manual entitlement, not a checkout flow.

- We email a single-use access code
- You authenticate with GitHub
- You paste a BYOK OpenRouter key
- Vercel credentials are optional; include them if you want validated deployment
- Supported lane: greenfield `nextjs-vercel` only

### Run it yourself

The code is MIT. Fork it, bring your own OpenAI-compatible LLM key,
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
hosting when you want deployment. Vercel free tier works for the default lane.

See [`llms.txt`](llms.txt) for a machine-readable overview of the pipeline,
agents, and architecture — useful for pointing your own AI tools at this repo.

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

## Filing issues

Issues drive the pipeline. For an issue to be picked up automatically:

1. **Add the `pipeline` label** — this routes it to auto-dispatch.
2. **Add a type label** — `bug`, `feature`, `enhancement`, `infra`, `docs`, or `test`. Without a type label the dispatcher classifies the issue as `missing_issue_type` and skips it.
3. **Optionally add a category label** — `frontend` routes to the visual agent instead of `repo-assist`.

**Writing good issues:**
- Describe the desired experience, not the implementation
- Include a "Scope" section with boundaries (what should and shouldn't change)
- Don't name specific files — the agent reads the codebase itself
- Acceptance criteria should be verifiable (build passes, behavior observable)
- Target ~1,000 characters — enough for the agent to act without ambiguity

Once labeled, `auto-dispatch.yml` fires and the appropriate agent picks it up. You can also manually trigger an agent by commenting `/repo-assist` on any issue.

## Self-hosting reference

### Required secrets

- `GH_AW_GITHUB_TOKEN` — PAT for issue creation and auto-merge
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — optional, for Vercel deploy validation

### Required repo settings

- Auto-merge enabled
- Delete branch on merge enabled
- Active `Protect main` ruleset on `main`

### Self-Serve Template Publication

If you use the `/build` flow, keep the template coordinates aligned in both places:

- Source repo Actions vars: `PUBLIC_BETA_TEMPLATE_OWNER`, `PUBLIC_BETA_TEMPLATE_REPO`
- Console env vars: `PUBLIC_BETA_TEMPLATE_OWNER`, `PUBLIC_BETA_TEMPLATE_REPO`

`publish-scaffold-template.yml` republishes `dist/scaffold/` into that template
repo. Edit only `prd-to-prod`; the template repo is generated output.

### Emergency controls

Set `PIPELINE_HEALING_ENABLED=false` as a repo variable to pause auto-repair.
The system still detects failures but won't dispatch fixes until re-enabled.

## Further reading

- [**Autonomy Policy**](autonomy-policy.yml) — what the system can and can't do
- [**Architecture**](docs/ARCHITECTURE.md) — how workflows and agents connect
- [**Why gh-aw**](docs/why-gh-aw.md) — why GitHub Actions is the control layer

## License

MIT
