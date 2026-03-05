# Self-Healing MVP Runbook

## What This Runbook Covers

This document covers the automatic repair system inside `prd-to-prod`.
It does not describe the entire system. It documents the repair path for the
current `.NET + Azure App Service` lane and the controls around it.

Week-one MVP support is currently validated only for the `dotnet-azure` profile
in [`.deploy-profile`](../.deploy-profile). The repository still contains
profile-aware CI and deploy routing for Node and Docker, but the reproducible
MVP claim in this runbook applies only to the current `.NET + Azure` path.

## Autonomy Boundary

This runbook applies only to the pipeline-generated path.

- Approved `[Pipeline]` PRs can be auto-merged by `pr-review-submit`.
- Human-authored PRs still run through review and CI, but remain manual by
  default.
- Self-healing means retry, redispatch (send the issue to the next available agent run), repair, escalation, and cleanup of
  pipeline incidents.
- Self-healing does not mean rollback automation, broad infrastructure mutation,
  or automatic merge of arbitrary approved PRs.

Humans still control:

- workflow definitions
- `autonomy-policy.yml`
- secrets and kill switches
- branch protection and required checks
- deploy policy and target changes

## Required Secrets

Configure these repository secrets before using the autonomous lane:

- `COPILOT_GITHUB_TOKEN`
- `GH_AW_GITHUB_TOKEN`
- `GH_AW_PROJECT_GITHUB_TOKEN`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

## Required Repository Variables

| Variable | Purpose | Default |
|---|---|---|
| `PIPELINE_HEALING_ENABLED` | Kill switch for autonomous healing (`false` to pause) | unset (enabled) |
| `GH_AW_MODEL_AGENT_COPILOT` | Model for continuous improvement agents | `gpt-5` |

Set variables with:

```bash
gh variable set GH_AW_MODEL_AGENT_COPILOT --body "gpt-5"
```

## Required Repo Settings

Bootstrap configures some of these automatically, but the live repo must end up
with all of them in place:

- auto-merge enabled
- delete branch on merge enabled
- squash merges allowed
- active `Protect main` ruleset on `main`
- `Protect main` requires 1 approving review
- `Protect main` requires the `review` status check
- `Protect main` remains squash-only with admin bypass enabled

## Healing Pause Switch

Use repository variable `PIPELINE_HEALING_ENABLED` as the stop-the-bleeding
control:

- unset or `true`: autonomous healing stays enabled
- `false`: review submission and failure detection still run, but autonomous
  auto-repair and pipeline auto-merge are paused

When paused, workflows still record incident state and escalation evidence. They
do not auto-dispatch `repo-assist`, repost repair commands, or arm pipeline PR
auto-merge.

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

That command runs shell decision-logic tests plus:

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

Run a real canary failure only from a clean local `main` with push access and a
clear reason to mutate the live branch:

```bash
bash scripts/self-healing-drill.sh run main_build_syntax
```

This intentionally pushes a broken commit to `main` and relies on the repair loop to fix it.

## Observable Evidence

For a passing audit or live drill, confirm all of the following evidence exists:

- a failing CI or deploy run URL
- a linked `[Pipeline] CI Build Failure` issue or `[CI Incident]` escalation
- an auto-dispatch or requeue run URL
- a repair PR URL
- a green CI run URL on the repair PR
- a merged commit on `main`
- a successful main recovery run URL
- a final drill JSON report under `drills/reports/`

For an approved `[Pipeline]` PR, you may also see an `auto-merge-armed` status
marker before merge completes. Human-authored PRs do not emit that marker,
because they are not auto-merged by default.

## Known Limitations

- There is no rollback automation.
- There is no external paging, Slack, or incident-management integration.
- Week-one MVP support is not claimed for profiles other than `dotnet-azure`.
- Watchdog and requeue behavior are mostly redispatch logic, not root-cause
  diagnosis.
- `repo-assist` remains single-slot throughput.
- Human-authored PRs are not auto-merged by the autonomous lane.

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

- The repair loop can redispatch and escalate, but it does not implement
  automatic rebase or PR recreation.

### Watchdog JSON parsing errors

Historical symptoms (fixed in the current watchdog implementation):

- `pipeline-watchdog` fails during orphaned-issue or stalled-PR scanning with
  `jq: parse error: Unfinished string at EOF`.
- Logs show watchdog iterating over raw JSON rows in a shell `for` loop.

What changed:

- The watchdog now iterates over JSON results with a line-safe
  `while IFS= read -r` loop and process substitution, preserving each JSON
  object as a single line and avoiding shell word-splitting.

If you still see these parsing errors, you are likely running an older commit
without the hardened watchdog fix. Update your branch to the latest `main`
before debugging further.

### Deferred dispatch vs direct dispatch

Symptoms:

- Drill reports show `dispatch_substate=deferred` or `deferred->requeued`.
- The issue contains a hidden `self-healing-dispatch-deferred:v1` marker.

Interpretation:

- `direct`: auto-dispatch ran immediately
- `deferred`: `repo-assist` was already active, so dispatch was postponed
- `deferred->requeued`: the requeue workflow picked it up later

### Approved PR did not auto-merge

Symptoms:

- The PR shows `APPROVED`.
- CI is green.
- No merge happens automatically.

Interpretation:

- only `[Pipeline]` PRs are auto-merged by the autonomous lane
- human-authored PRs can use the same review workflows and status checks, but
  they stay manual unless you intentionally change the merge policy
- policy-blocked or sensitive-path changes remain stopped until a human clears
  them

### Local tests pass but GitHub audit fails

Symptoms:

- `dotnet test TicketDeflection.sln` passes locally
- `bash scripts/self-healing-drill.sh audit <sha>` fails

Typical causes:

- required secrets or labels are missing in the GitHub repo
- repo settings differ from the documented `Protect main` ruleset
- the audited commit predates the current self-healing workflow behavior
- the repair path completed manually instead of via autonomous dispatch
