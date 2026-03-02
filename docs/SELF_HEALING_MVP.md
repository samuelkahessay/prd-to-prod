# Self-Healing MVP Runbook

## Supported MVP Scope

Week-one MVP support is currently validated for the `dotnet-azure` profile in
[.deploy-profile](/Users/skahessay/Documents/Projects/active/prd-to-prod/.deploy-profile).

This repository still contains profile-aware CI and deploy routing for Node and
Docker, but the reproducible MVP claim in this runbook applies only to the
current `.NET + Azure App Service` path.

## Required Secrets

Configure these repository secrets before using the autonomous loop:

- `COPILOT_GITHUB_TOKEN`
- `GH_AW_GITHUB_TOKEN`
- `GH_AW_PROJECT_GITHUB_TOKEN`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

## Required Repo Settings

Bootstrap configures some of these automatically, but the live repo must end up
with all of them in place:

- Auto-merge enabled
- Delete branch on merge enabled
- Squash merges allowed
- Active `Protect main` ruleset on `main`
- `Protect main` requires 1 approving review
- `Protect main` requires the `review` status check
- `Protect main` remains squash-only with admin bypass enabled

## Bootstrap Steps

```bash
gh extension install github/gh-aw
bash scripts/bootstrap.sh
gh aw secrets bootstrap
```

Then verify the repo settings listed above before relying on autonomous merge
and repair behavior.

## Local Verification

The fastest local MVP check is:

```bash
bash scripts/verify-mvp.sh --skip-audit
```

That command runs the shell decision-logic tests plus:

```bash
dotnet test TicketDeflection.sln
```

## Audit Drill Command

Use the known-good March 1, 2026 drill commit to verify the end-to-end repair
path without mutating `main`:

```bash
bash scripts/verify-mvp.sh --audit-commit ff2f18746416dfb8ae8bfe1e414e031983a5fb73
```

The raw audit command is:

```bash
bash scripts/self-healing-drill.sh audit ff2f18746416dfb8ae8bfe1e414e031983a5fb73
```

## Live Drill Command

Run a real canary failure only from a clean local `main` with push access:

```bash
bash scripts/self-healing-drill.sh run main_build_syntax
```

This intentionally pushes a broken commit to `main` and relies on the pipeline
to heal it.

## Observable Evidence

For a passing audit or live drill, confirm all of the following evidence exists:

- A failing CI or deploy run URL
- A linked `[Pipeline] CI Build Failure` issue or `[CI Incident]` escalation
- An auto-dispatch or requeue run URL
- A repair PR URL
- A green CI run URL on the repair PR
- A merged commit on `main`
- A successful main recovery run URL
- A final drill JSON report under `drills/reports/`

## Known Limitations

- There is no rollback automation.
- There is no external paging, Slack, or incident-management integration.
- Week-one MVP support is not claimed for profiles other than `dotnet-azure`.
- Watchdog and requeue behavior are mostly redispatch logic, not root-cause
  diagnosis.

## Troubleshooting

### Missing `GH_AW_GITHUB_TOKEN`

Symptoms:

- CI failure routing logs warnings about `GH_AW_GITHUB_TOKEN` being unavailable.
- Repair commands are not posted.
- Auto-created failure issues warn that the self-healing loop is disabled.

Check:

```bash
gh secret list
```

### Missing self-healing labels

Symptoms:

- PR incident labels such as `ci-failure`, `repair-in-progress`, or
  `repair-escalated` are missing.
- Watchdog or router logs warning messages when adding labels.

Fix:

```bash
bash scripts/bootstrap.sh
gh label list
```

### Stale branch or push failure

Symptoms:

- Repo-assist comments that it could not push fixes to an existing PR branch.
- The PR remains open with `CHANGES_REQUESTED` or repeated CI failures.
- `[aw]` issues or escalation issues appear after repeated retries.

What it means:

- The self-healing loop can redispatch and escalate, but it does not yet
  implement an automatic rebase or PR recreation strategy.

### Deferred dispatch vs direct dispatch

Symptoms:

- Drill reports show `dispatch_substate=deferred` or `deferred->requeued`.
- The issue contains a hidden `self-healing-dispatch-deferred:v1` marker.

Interpretation:

- `direct`: auto-dispatch ran immediately.
- `deferred`: repo-assist was already active, so dispatch was postponed.
- `deferred->requeued`: the requeue workflow picked it up later.

### Local tests pass but GitHub audit fails

Symptoms:

- `dotnet test TicketDeflection.sln` passes locally.
- `bash scripts/self-healing-drill.sh audit <sha>` fails.

Typical causes:

- Required secrets or labels are missing in the GitHub repo.
- Repo settings differ from the documented `Protect main` ruleset.
- The audited commit predates the current self-healing workflow behavior.
- The repair path completed manually instead of via autonomous dispatch.
