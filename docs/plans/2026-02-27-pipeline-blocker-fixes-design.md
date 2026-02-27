# Pipeline Blocker Fixes Design

Date: 2026-02-27
Status: Approved
Scope: BLOCKER 3, BLOCKER 4, issue auto-close edge case, cross-issue false CHANGES_REQUESTED, action_required platform limitation

## Problem Statement

Run 3 (DevCard) achieved 91% autonomous feature delivery but exposed 5 outstanding issues. The two highest-impact problems are duplicate PRs from concurrent dispatches (BLOCKER 3) and no auto-cleanup of superseded PRs (BLOCKER 4). Three lower-severity issues also need fixes.

## Fix 1: Dispatch-Layer Dedup (auto-dispatch.yml) — Best-Effort

**Goal**: Reduce (not eliminate) concurrent repo-assist dispatches from issue creation bursts.

**Changes to `auto-dispatch.yml`**:

1. Switch concurrency to `cancel-in-progress: true`. When the decomposer creates 10 issues in 12 seconds, only the last auto-dispatch survives. This is correct because repo-assist picks up ALL open pipeline issues regardless of which issue triggered the dispatch.

2. Add `sleep 15` debounce before the guard check. Lets the decomposer finish creating issues and lets any just-dispatched repo-assist appear in the GitHub API.

3. Keep the existing guard check (skip if repo-assist already queued or running).

4. Keep the `labeled` filter (`github.event.label.name == 'pipeline'`).

**Net effect**: Decomposer burst of N issues -> N auto-dispatch triggers -> N-1 cancelled -> 1 survivor waits 15s -> guard check -> 1 repo-assist dispatch.

**This is best-effort.** repo-assist's own dedup check is the authoritative layer.

## Fix 2: repo-assist Dedup Check (repo-assist.md) — Authoritative

**Goal**: Prevent repo-assist from creating PRs for issues that already have an open or merged Pipeline PR.

**Changes to `repo-assist.md` Task 1**:

### Check 1: Before checkout (step 3a-ii, new)

After reading the issue (3a) and before checking out main (3b):

> Run `gh pr list --repo $REPO --search "Closes #N" --state all --json number,state,title`. Filter results to PRs with `[Pipeline]` title prefix. If any result has state `open` or `merged`, skip this issue silently — update memory and move to the next issue. Closed (unmerged) PRs do NOT count as covered (they represent failed attempts).

### Check 2: Before PR creation (step 3g, updated)

Immediately before `create-pull-request`:

> Re-run the dedup check from 3a-ii. If a `[Pipeline]` PR is now open or merged for this issue (a concurrent run beat you), abandon your branch and skip. Do not create a duplicate PR.

**Why two checks**: Check 1 saves runner time by skipping early. Check 2 narrows the race window to seconds (between the check and the actual PR creation API call).

**Filter logic**: Match `[Pipeline]` prefix. Match close keywords: `closes`, `close`, `fix`, `fixes`, `resolve`, `resolves` followed by `#N`. Only skip on `open` or `merged` state.

## Fix 3: Superseded PR Cleanup (pr-review-submit.yml + pipeline-watchdog.yml)

**Goal**: Automatically close duplicate PRs after one copy merges.

### Primary: pr-review-submit.yml

Add a new step after "Close linked issues after merge" in BOTH jobs (submit-review-comment and submit-review-dispatch):

```yaml
- name: Close superseded duplicate PRs
```

Logic:
1. Only runs if `MERGED=true` was observed by the merge poll AND `ISSUE_NUMBER` is set.
2. Finds other open `[Pipeline]` PRs whose body matches close keywords for the same issue number.
3. Excludes the current PR number.
4. Closes each duplicate with `gh pr close --delete-branch` and a comment: "Superseded by PR #N which merged and closed issue #M."
5. Regex: `(?i)(closes?|fix(es)?|resolves?)\\s+#ISSUE_NUMBER\\b`

### Backup: pipeline-watchdog.yml

Add a third detection pass after "stalled PRs" and "orphaned issues":

```
# Detect superseded PRs: open [Pipeline] PRs whose linked issue is already closed
```

Logic:
1. For each open `[Pipeline]` PR, extract `Closes #N` from the body.
2. Check if issue #N is CLOSED.
3. Check if there exists at least one MERGED `[Pipeline]` PR that also references `Closes #N`.
4. Only close the PR if BOTH conditions are true (issue closed AND another PR already merged for it).
5. This prevents accidentally closing valid PRs tied to manually closed/won't-fix issues.

## Fix 4: Issue Auto-Close Reliability (pr-review-submit.yml)

**Goal**: Reduce the ~10% failure rate on issue auto-closing.

**Changes to BOTH jobs in `pr-review-submit.yml`**:

1. Increase merge poll from 12x5s (60s) to 24x5s (120s). Auto-merge sometimes takes longer when status checks propagate slowly.

2. On timeout, if `ISSUE_NUMBER` is set and the issue is still OPEN, post a comment on the issue: "Merge not observed within 120s for PR #N. Issue closure deferred to watchdog."

3. Do NOT claim "PR merged" in the timeout message — we didn't observe it.

## Fix 5: Cross-Issue False CHANGES_REQUESTED (Prompts)

**Goal**: Prevent the reviewer from flagging acceptance criteria that belong to not-yet-implemented dependency issues.

### prd-decomposer.md — New decomposition rule 8:

> **8. Self-contained acceptance criteria.** Each issue's acceptance criteria must ONLY reference files, functions, and artifacts that will be created or modified IN THAT ISSUE. Do not include criteria that depend on artifacts from other issues. If a feature spans multiple issues, each issue's criteria should cover only its portion. Example: if Issue A creates `page.tsx` and Issue B adds OG metadata to it, Issue B's criteria should say "Add OG metadata to the card page" NOT "Update `generateMetadata` in `src/app/card/[username]/page.tsx`" — because that file doesn't exist until Issue A merges.

### pr-review-agent.md — New decision rule:

> **Deferred criteria**: If an acceptance criterion references a file or export that does not exist in the repository OR in the PR diff, check the linked issue's `## Dependencies` section for an explicit `Depends on #N` reference. Then verify issue #N is still OPEN via `gh issue view`. **Only mark as DEFERRED if both conditions are true** (explicit dependency exists AND that issue is still open). Use `- [ ] ~Criterion -- DEFERRED: depends on #N which is not yet merged~`. Deferred criteria do NOT count as unmet. If the missing artifact has no matching dependency reference, treat the criterion as **unmet** and REQUEST_CHANGES -- note in your summary that the decomposer may need to reassign this criterion to the correct issue.

## Fix 6: action_required Workflow Approval (Repo Setting)

**Goal**: Eliminate the first-time contributor approval gate on issue_comment-triggered workflows.

**API call**:
```
gh api repos/samuelkahessay/agentic-pipeline/actions/permissions/fork-pr-contributor-approval \
  --method PUT -f approval_policy=first_time_contributors_new_to_github
```

This narrows the gate to accounts that have never contributed to ANY GitHub repo. Bot accounts (gh-aw, copilot-swe-agent) have activity on other repos and will pass automatically.

Not a code change — a one-time repo setting update.

## Files Modified

| File | Fix | Change Type |
|------|-----|-------------|
| `.github/workflows/auto-dispatch.yml` | Fix 1 | cancel-in-progress, debounce |
| `.github/workflows/repo-assist.md` | Fix 2 | Dedup check in Task 1 |
| `.github/workflows/pr-review-submit.yml` | Fix 3, Fix 4 | Superseded PR cleanup, 120s poll, both jobs |
| `.github/workflows/pipeline-watchdog.yml` | Fix 3 | Superseded PR detection pass |
| `.github/workflows/prd-decomposer.md` | Fix 5 | Self-contained criteria rule |
| `.github/workflows/pr-review-agent.md` | Fix 5 | DEFERRED criteria rule |
| Repo settings (API) | Fix 6 | approval_policy change |

## Implementation Order

1. Fix 6 (repo setting) — one API call, zero risk, immediate effect
2. Fix 1 (auto-dispatch) — small YAML change, low risk
3. Fix 2 (repo-assist dedup) — prompt change, needs compile
4. Fix 4 (120s poll) — small YAML change in pr-review-submit
5. Fix 3 (superseded cleanup) — new steps in pr-review-submit + watchdog
6. Fix 5 (prompt changes) — decomposer + reviewer, needs compile

Fixes 1-2 together solve BLOCKER 3. Fix 3 solves BLOCKER 4. Each fix is independently deployable.
