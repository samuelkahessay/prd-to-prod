# Pipeline Hardening Batch — Design

Date: 2026-03-02

Five improvements to the autonomous pipeline, ordered by priority. Items #5, #2, #7, and #1 are direct implementation (workflow/script/config changes). Item #3 is an investigation that may lead to implementation later.

---

## 1. Sensitive-Path HITL Gate (Priority 1)

### Problem

The pipeline auto-merges all approved PRs whose changed files match `autonomous` policy actions. There is no elevated review gate for security-sensitive application paths (auth, compliance, payments). A pipeline agent could modify authentication logic and have it auto-merged with only automated review.

### Design

**New policy action** in `autonomy-policy.yml`:

```yaml
- action: sensitive_app_change
  scope: Modify application code in security-sensitive, compliance, or payment paths.
  default_mode: human_required
  requires_human_reason: >
    Changes to authentication, compliance, or payment logic carry elevated risk
    and require human review before merge.
  allowed_targets:
    - TicketDeflection/**/Auth/**
    - TicketDeflection/**/Compliance/**
    - TicketDeflection/**/Payments/**
    - src/**/auth/**
    - src/**/compliance/**
    - src/**/payments/**
  evidence_required:
    - Human-approved sensitive change
    - Security or compliance impact assessment
    - Test coverage for the sensitive path
```

**Workflow changes** in `pr-review-submit.yml`:

1. Extend the existing autonomy policy check loop to also match `sensitive_app_change` for each changed file.
2. When matched: block auto-merge, post a comment identifying the sensitive files and requesting `/approve-sensitive`.
3. Set a `sensitive-review` commit status to `pending` on the HEAD SHA.
4. New comment handler: when `/approve-sensitive` is commented by the repo owner, set `sensitive-review` to `success`, re-enable auto-merge, post confirmation.

**Enforcement**: Workflow-only (soft block). Auto-merge won't arm, but a human could force-merge via GitHub UI in emergencies. No branch protection ruleset changes.

**What doesn't change**: `app_code_change` stays autonomous for non-sensitive paths. Review agent verdict logic unaffected. Branch protection rules unchanged.

---

## 2. Semantic CI Diagnostic (Priority 2)

### Problem

When CI fails on a pipeline PR, `ci-failure-issue.yml` extracts basic failure context (type, signature, summary, excerpt) and posts a repair command. But the repair command doesn't correlate the error with the PR's changes, so `repo-assist` has to re-derive this relationship by reading logs and the diff separately. This adds latency to every repair cycle.

### Design

**Extend `scripts/extract-failure-context.sh`** with optional `--changed-files` flag:

- Accepts a newline-separated list of changed file paths.
- Extracts file paths from error lines (`.cs`, `.ts`, `.js`, etc.).
- Cross-references against the changed files list.
- Produces two new JSON fields:
  - `hypothesis`: Human-readable string correlating the error to the change (or noting it's a downstream dependency).
  - `correlated_files`: Array of changed files that appear in the error output.
- When no file path is extractable from the error, both fields are null.

Example output:

```json
{
  "failure_type": "build",
  "failure_signature": "cs0246-the-type-or-namespace",
  "summary": "error CS0246: The type or namespace 'AuthService'...",
  "excerpt": "...",
  "hypothesis": "Error references AuthService.cs which was modified in this PR.",
  "correlated_files": ["TicketDeflection/Services/AuthService.cs"]
}
```

**Extend `scripts/render-ci-repair-command.sh`** with `--hypothesis` and `--correlated-files` flags. Include in the rendered repair command body:

```
### Diagnostic Hypothesis
{hypothesis}

### Correlated Changed Files
{file list}
```

**Update `ci-failure-issue.yml`** in the PR repair path:

```bash
CHANGED_FILES=$(gh pr diff "$PR_NUMBER" --name-only)
CONTEXT=$(echo "$RAW_LOGS" | scripts/extract-failure-context.sh --changed-files "$CHANGED_FILES")
```

Pass hypothesis through to `render-ci-repair-command.sh`.

**Scope**: PR-attached failures only. Main-branch failures (no PR, no diff) are left as-is.

**What doesn't change**: repo-assist's CI Repair Command Mode prompt stays the same. The richer context arrives in the command body it already reads. The repair marker format is unchanged (new fields are in the body, not the marker).

---

## 3. Context Checkpoints via repo-memory (Priority 3)

### Problem

When `repo-assist` runs hit their timeout or encounter an error mid-task, all working context is lost. The next run starts from scratch, re-reading the issue and re-discovering the codebase state. This wastes time and can lead to duplicate work.

### Design

**Prompt-engineering addition to `repo-assist.md`**. Add a "Checkpoint Protocol" section after the existing "Memory" section:

```markdown
## Checkpoint Protocol

Write structured checkpoint entries to repo-memory at these moments:
1. **Plan checkpoint** — after reading an issue and forming an implementation plan, before writing code.
2. **Progress checkpoint** — after completing a significant code change (new file, test passing).
3. **Pre-PR checkpoint** — immediately before creating or pushing to a PR.

Each checkpoint entry key: `checkpoint:<issue-number>:<stage>`
Value: JSON with:
- `timestamp`: ISO 8601
- `stage`: plan | progress | pre-pr
- `issue`: issue number
- `summary`: 1-2 sentence description of current state
- `files_touched`: list of files modified so far
- `blockers`: any blockers encountered (empty array if none)
- `next_step`: what you plan to do next

Read your latest checkpoint at the start of every run. If a checkpoint exists for
the current issue, resume from that state rather than starting over.
```

**What doesn't change**: Existing memory usage (backlog cursor, attempt tracking). No new tools or workflow files. Purely additive prompt text.

---

## 4. Parallel Dispatch Investigation (Priority 4)

### Problem

`auto-dispatch.yml` enforces a single-slot guard: only one `repo-assist` run at a time. This serializes all pipeline work. If 5 independent issues are ready, they queue behind each other. The requeue mechanism helps but doesn't eliminate the bottleneck.

### Design

**Investigation only — no code changes.** Read the gh-aw source at the local path to answer:

1. **Concurrency model**: Does gh-aw's compiled workflow support multiple simultaneous runs of the same workflow targeting different issues? What does the concurrency group key to?
2. **Repo-memory safety**: Is `repo-memory` a shared store or per-run? Is there a locking mechanism for concurrent access?
3. **Rate limits**: What GitHub API calls does a single `repo-assist` run make? What's the budget for 3-5 concurrent runs?
4. **Recommendation**: Safe to parallelize? If so, what cap? What changes to `auto-dispatch.yml` are needed?

**Output**: `docs/internal/gh-aw-upstream/parallel-dispatch-investigation.md`

**What doesn't change**: `auto-dispatch.yml` stays as-is until findings are reviewed and a follow-up design is approved.

---

## 5. `llms.txt` (Priority 5)

### Problem

No AI-readable sitemap exists at the repo root. External AI tools (Copilot Chat, Claude Code) browsing the repo have no standardized entry point.

### Design

New file `llms.txt` at repo root:

```
# prd-to-prod

> Autonomous software pipeline powered by gh-aw (GitHub Agentic Workflows).
> Issues labeled `pipeline` are implemented by AI agents. No human writes implementation code.

## Agent Instructions
- [AGENTS.md](AGENTS.md) — Coding standards, build commands, PR requirements
- [autonomy-policy.yml](autonomy-policy.yml) — What agents can and cannot do autonomously

## Architecture
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture

## Key Workflows
- .github/workflows/auto-dispatch.yml — Dispatches repo-assist for pipeline issues
- .github/workflows/ci-failure-issue.yml — Routes CI failures to repair
- .github/workflows/pr-review-submit.yml — Submits reviews and arms auto-merge

## Configuration
- .deploy-profile — Active deployment profile
- .github/deploy-profiles/ — Stack-specific build/test/deploy commands
```

**What doesn't change**: `AGENTS.md` remains the primary agent instruction file. No workflow changes.

---

## Implementation Order

1. `llms.txt` — trivial, no dependencies, ship first
2. `autonomy-policy.yml` + `pr-review-submit.yml` (HITL gate)
3. `extract-failure-context.sh` + `render-ci-repair-command.sh` + `ci-failure-issue.yml` (semantic diagnostic)
4. `repo-assist.md` (context checkpoints)
5. Parallel dispatch investigation (read gh-aw source, write findings)

Items 1-4 are implementable in parallel. Item 5 is research.
