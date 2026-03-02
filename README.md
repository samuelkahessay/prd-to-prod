# PRD to Prod

A policy-bounded AI execution engine. Humans set intent and policy. AI executes within bounds.

An autonomous software pipeline that decomposes product requirements into
GitHub Issues, implements them as Pull Requests, reviews its own code,
auto-merges approved `[Pipeline]` PRs, and self-heals common pipeline failures --
all within a formal autonomy policy that defines where AI authority starts and
where it stops. Powered by [gh-aw](https://github.com/github/gh-aw) agentic
workflows.

```
  PRD ---------> Issues ---------> Code ----------> Review --------> Merge --> Ship
  prd-decomposer  |   repo-assist    |   pr-review-agent  pr-review-submit
                   |                  |       [policy gate]           |
                   |                  |                               |
                   +------------- loop until done -------------------+
                                     |
                              CI / Deploy
                                     |
              +----------------------+----------------------+
              |                      |                      |
        ci-failure-issue        ci-doctor           pipeline-watchdog
        (repair loop)        (diagnostics)          (stall rescue)

  ---- auxiliary (scheduled / manual) ----
  code-simplifier        daily    simplify recently changed code
  duplicate-code-detector daily    detect duplication patterns
  security-compliance    manual   scan vulnerabilities before audit
  pipeline-status        on-demand  project board sync
```

**Who decides:** Human (policy owner, PRD author, break-glass operator)
**What AI does:** Executes within policy -- decomposes, implements, reviews, merges, repairs
**Where AI stops:** Control-plane changes, policy changes, secret rotation, deploy policy, branch protection

## Autonomy Policy

The system ships a machine-readable policy artifact
([`autonomy-policy.yml`](autonomy-policy.yml)) that classifies every action the
pipeline can take. The policy is human-owned and cannot be modified by the
pipeline itself.

**Core defaults:**

| Default | Value | Effect |
|---------|-------|--------|
| `unknown_action` | `human_required` | Any action not listed in the policy requires human approval |
| `fail_closed` | `true` | On ambiguity, the system stops and escalates |
| `policy_owner` | `human` | Only humans can modify the policy file |

**Action classification:**

| Action | Mode | Scope |
|--------|------|-------|
| Issue decomposition | `autonomous` | Convert PRDs into dependency-ordered issues |
| App code change | `autonomous` | Implement or refine application and test code |
| Documentation change | `autonomous` | Update docs that explain implemented behavior |
| CI repair (existing PR) | `autonomous` | Fix failing pipeline PRs without scope expansion |
| Auto-merge pipeline PR | `autonomous` | Arm auto-merge for approved `[Pipeline]` PRs |
| Policy artifact change | `human_required` | Modify `autonomy-policy.yml` or authority definitions |
| Workflow file change | `human_required` | Modify `.github/workflows/` or agent instructions |
| Secret or token change | `human_required` | Create, rotate, or expose credentials or kill-switch variables |
| Deploy policy change | `human_required` | Change deployment destinations or environment routing |
| Merge scope expansion | `human_required` | Expand which PRs may be auto-merged |
| Branch protection change | `human_required` | Modify rulesets, required checks, or push permissions |

**Merge-gate enforcement:** The PR review agent checks every PR against the
autonomy policy before issuing a verdict. PRs that contain `human_required`
actions without human approval are rejected at the merge gate.

## How the Pipeline Works

1. **Write a PRD** -- paste it in a GitHub Issue
2. **`/decompose`** -- AI breaks it into issues with acceptance criteria and dependency ordering
3. **`repo-assist`** -- AI implements each issue as a PR (branch, code, test, open)
4. **`pr-review-agent`** -- AI reviews the full diff against acceptance criteria and autonomy policy
5. **`pr-review-submit`** -- formal review + auto-merge for approved `[Pipeline]`
   PRs + re-dispatch for the next issue
6. **Self-healing** -- watchdog catches stalls, CI failures feed the repair loop,
   and unresolved incidents escalate

The autonomous loop runs until every issue from the PRD is shipped. Human PRs
can still use the same review workflows, but they remain outside the auto-merge
path.

## Shipped So Far

Four complete apps built within policy bounds -- zero human implementation code written.

| Run | App | Stack | Tag |
|-----|-----|-------|-----|
| 01 | [Code Snippet Manager](showcase/01-code-snippet-manager/) | Express + TypeScript | [`v1.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v1.0.0) |
| 02 | [Pipeline Observatory](showcase/02-pipeline-observatory/) | Next.js 14 + TypeScript | [`v2.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v2.0.0) |
| 03 | [DevCard](showcase/03-devcard/) | Next.js 14 + TypeScript + Framer Motion | [`v3.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v3.0.0) |
| 04 | [Ticket Deflection Service](https://prd-to-prod.azurewebsites.net/) | ASP.NET Core + C# | [`v4.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v4.0.0) |

Each run produces a different app with a different tech stack -- the pipeline is stack-agnostic.

See [`showcase/`](showcase/) for detailed run reports.

## Quick Start

Week-one MVP support is currently validated for the `dotnet-azure` profile.
See [docs/SELF_HEALING_MVP.md](docs/SELF_HEALING_MVP.md) for the operator runbook.

```bash
# 1. Clone
git clone https://github.com/samuelkahessay/prd-to-prod.git
cd prd-to-prod

# 2. Install gh-aw
gh extension install github/gh-aw

# 3. Bootstrap (creates labels, compiles workflows, seeds memory)
bash scripts/bootstrap.sh

# 4. Configure secrets
gh aw secrets bootstrap

# 5. Verify repo settings
#    - auto-merge enabled
#    - delete branch on merge enabled
#    - active Protect main ruleset

# 6. Push
git push

# 7. Create an issue with your PRD, then comment: /decompose
```

**Requirements:** GitHub account with Copilot subscription, GitHub CLI (`gh`) v2.0+, `gh-aw` extension.

### Required Secrets

- `COPILOT_GITHUB_TOKEN`
- `GH_AW_GITHUB_TOKEN`
- `GH_AW_PROJECT_GITHUB_TOKEN`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

### Required Repo Settings

- Auto-merge enabled
- Delete branch on merge enabled
- Active `Protect main` ruleset on `main`

### Emergency Controls

Set repository variable `PIPELINE_HEALING_ENABLED=false` to pause autonomous
healing. Review submission and failure detection still run, but auto-dispatch,
watchdog remediation, repair-command posting, and pipeline auto-merge are
skipped until the variable is unset or set back to `true`.

The healing pause switch is classified as a `secret_or_token_change` action in
the autonomy policy -- human-owned, not modifiable by the pipeline.

## Further Reading

- [**Autonomy Policy**](autonomy-policy.yml) -- the machine-readable policy artifact
- [**Architecture**](docs/ARCHITECTURE.md) -- workflow details, design decisions, self-healing mechanics
- [**Self-Healing MVP**](docs/SELF_HEALING_MVP.md) -- setup, verification steps, drill commands
- [**Why gh-aw**](docs/why-gh-aw.md) -- rationale for the gh-aw + GitHub Actions split

## License

MIT
