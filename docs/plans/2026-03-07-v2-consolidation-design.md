# Design: v2 Consolidation — One Source Repo, Exported Scaffold, Two Operating Modes

> Merge meeting-to-main into prd-to-prod. Replace hand-maintained template with a generated scaffold artifact. Add v2 routing for existing-product meetings.

Date: 2026-03-07

**Canonical location:** This doc originates in `meeting-to-main/docs/plans/` but must be
copied to `prd-to-prod/docs/plans/` before Phase 1 execution begins. Phase 1 archives
meeting-to-main, so prd-to-prod must hold the migration doc before that happens.

---

## 1. Problem Statement

Today, three repos maintain overlapping pipeline infrastructure with no automated sync:

- **prd-to-prod** — reference implementation (26 workflows, .NET app, operational scripts)
- **prd-to-prod-template** — hand-maintained fork of prd-to-prod's workflows (27 workflows, studio UI, setup wizard)
- **meeting-to-main** — thin ingress/extraction layer that triggers the template

Drift is inevitable. Workflows, deploy profiles, and scripts diverge. Changes must be applied to two or three places. The template is a maintenance liability.

Additionally, meeting-to-main only handles greenfield (new product → new repo). It cannot route meeting output to an existing product's repo as features or bugs.

**Target steady state:** one maintained source repo, `prd-to-prod`. `meeting-to-main` becomes a mode inside that repo. `prd-to-prod-template` is treated only as a legacy migration input while its scaffold-only assets are ported into `prd-to-prod`; after that, the scaffold is an exported artifact, not a sibling repo.

---

## 2. Design Principles

1. **One source of truth.** prd-to-prod is the only repo humans edit.
2. **Scaffold is a build artifact.** Generated from an explicit allowlist, never hand-maintained.
3. **The manifest is the boundary.** `template-manifest.yml` defines what enters the scaffold. Everything else is product-only by omission.
4. **Leak test is a hard gate.** Export fails if forbidden paths appear in output.
5. **Bootstrap test is a smoke gate.** A temp repo from the scaffold must setup/compile/smoke successfully.
6. **Generated repos are standalone.** No runtime dependency on the source repo.
7. **Steady state is one maintained repo.** Legacy repos may exist during migration, but only `prd-to-prod` remains part of the architecture.

---

## 3. Consolidated Repo Structure

After absorbing meeting-to-main into prd-to-prod:

Steady state has one maintained repo (`prd-to-prod`), one exported scaffold artifact (`dist/scaffold/` or a published branch/repo), and many generated output repos. The scaffold is not a second maintained product repo.

```
prd-to-prod/
│
│ ── Pipeline Infrastructure (canonical, exported to scaffold) ──
│
├── .github/
│   ├── workflows/                    ← canonical workflow definitions
│   │   ├── *.md                      ← agent workflow source (human-edited)
│   │   ├── *.lock.yml                ← compiled agent workflows (gh aw compile)
│   │   ├── *.yml                     ← standard Actions (routing, deploy, CI, recovery)
│   │   └── shared/reporting.md       ← shared reporting utilities
│   ├── deploy-profiles/              ← nextjs-vercel, docker-generic, dotnet-azure
│   ├── agents/agentic-workflows.agent.md
│   ├── aw/actions-lock.json
│   ├── copilot-instructions.md
│   └── ISSUE_TEMPLATE/
│
├── studio/                           ← Next.js dashboard + landing page
├── scripts/                          ← operational scripts (subset exported)
│   └── classify-ci-failure.sh        ← deterministic CI failure classifier
├── docs/
│   ├── ARCHITECTURE.md               ← exported (stable reference)
│   ├── SELF_HEALING_MVP.md           ← exported
│   ├── why-gh-aw.md                  ← exported
│   ├── decision-ledger/README.md     ← exported (framework)
│   └── prd/sample-prd.md             ← exported (reference PRD)
│
├── autonomy-policy.yml               ← exported (rendered template)
├── .deploy-profile                   ← exported (rendered template)
├── AGENTS.md                         ← exported (rendered template)
├── setup.sh                          ← exported
├── setup-verify.sh                   ← exported
├── vercel.json                       ← exported
├── .gitignore                        ← exported
├── LICENSE                           ← exported
├── README.template.md                ← exported as README.md
│
│ ── Ingress / Extraction (absorbed from meeting-to-main) ──
│
├── extraction/
│   ├── run.sh                        ← unified entry point
│   ├── classify.sh                   ← decides greenfield vs existing
│   ├── extract-prd.sh                ← v1: transcript → PRD
│   ├── extract-issues.sh             ← v2: transcript → classified issues
│   ├── prompt.md                     ← PRD generation prompt (v1)
│   ├── prompt-issues.md              ← issue extraction prompt (v2)
│   ├── analyze-target.sh             ← v2: per-requirement gap analysis against target repo
│   ├── prompt-file-selector.md       ← Stage 1: tree + requirement → relevant file paths
│   ├── prompt-gap-analysis.md        ← Stage 2: files + requirement → GapItem JSON
│   ├── validate-deployment.sh        ← v2+: post-deploy requirement verification
│   ├── prompt-validate-claim.md      ← adversarial QA prompt for atomic claim verification
│   ├── validate-schema.sh            ← generic JSON schema validation helper
│   ├── schemas/                      ← JSON schemas for LLM output validation
│   │   ├── issues-output.json
│   │   ├── gap-item.json
│   │   ├── file-selector-output.json
│   │   └── validation-result.json
│   ├── validate.sh                   ← PRD structure + tech stack validation
│   ├── workiq-client.ts              ← WorkIQ MCP client
│   └── test-fixtures/
│
├── trigger/
│   ├── push-to-pipeline.sh           ← v1: seeds repo from scaffold, provisions, dispatches
│   └── push-to-existing.sh           ← v2: creates labeled issues in target repo
│
│ ── Scaffold Export ──
│
├── scaffold/
│   ├── template-manifest.yml         ← allowlist: what enters dist/scaffold/
│   ├── export-scaffold.sh            ← reads manifest, compiles lock files, builds dist/scaffold/
│   ├── leak-test.sh                  ← fails if forbidden paths appear in dist/scaffold/
│   └── bootstrap-test.sh             ← creates temp repo, verifies setup/compile/smoke
│
│ ── Product-Only (never exported) ──
│
├── PRDtoProd/                        ← active .NET application
├── PRDtoProd.Tests/                  ← application tests
├── showcase/                         ← run manifests + history
├── drills/                           ← self-healing evidence
├── mocks/                            ← WorkIQ test fixtures
├── console/                          ← operator UI (localhost:3000, source-repo-only)
│   ├── server.js
│   ├── lib/                          ← orchestrator, event store, preflight
│   ├── routes/                       ← API endpoints (preflight, run, stream, history)
│   └── public/                       ← HTML, CSS, vanilla JS
├── docs/prd/                         ← historical PRDs (except sample-prd.md)
├── docs/run-log-*.md                 ← run traces
├── Dockerfile                        ← product build
├── global.json                       ← .NET SDK version
├── .sisyphus/                        ← operational planning
├── README.md                         ← product README (not exported)
└── CLAUDE.md                         ← product dev guide (not exported)
```

---

## 4. Scaffold Export Mechanism

### 4.1 Manifest (Selection)

`scaffold/template-manifest.yml` is the single source of truth for what enters the scaffold. Allowlist only — everything not listed is excluded by omission.

```yaml
# scaffold/template-manifest.yml
# Allowlist: only these paths appear in dist/scaffold/.
# Everything not listed is product-only and never exported.

version: 1

include:
  # ── Pipeline workflows ──
  - .github/workflows/
  - .github/deploy-profiles/
  - .github/agents/agentic-workflows.agent.md
  - .github/aw/actions-lock.json
  - .github/copilot-instructions.md
  - .github/ISSUE_TEMPLATE/

  # ── Dashboard ──
  - studio/

  # ── Scripts (runtime dependencies of workflows) ──
  # Rule: if any workflow sparse-checkouts or calls scripts/foo.sh, it must be here.
  # Derived from: auto-dispatch.yml, pr-review-submit.yml, close-issues.yml,
  #   ci-failure-issue.yml, ci-failure-resolve.yml, pipeline-watchdog.yml,
  #   auto-dispatch-requeue.yml, bootstrap.sh, dotnet-ci.yml (pipeline-scripts job).
  #
  # Workflow-referenced scripts (sparse-checkout'd at runtime):
  - scripts/healing-control.sh                # auto-dispatch, pr-review-submit, ci-failure-issue, watchdog
  - scripts/classify-pipeline-issue.sh        # auto-dispatch, auto-dispatch-requeue
  - scripts/classify-pipeline-pr.sh           # pr-review-submit
  - scripts/check-autonomy-policy.sh          # pr-review-submit
  - scripts/extract-failure-context.sh        # ci-failure-issue, ci-failure-resolve
  - scripts/extract-linked-issue-numbers.sh   # pr-review-submit, close-issues, auto-dispatch-requeue, ci-failure-issue
  - scripts/render-ci-repair-command.sh       # ci-failure-issue
  - scripts/pipeline-watchdog.sh              # pipeline-watchdog
  #
  # Bootstrap dependencies (called by bootstrap.sh or setup.sh):
  - scripts/bootstrap.sh
  - scripts/patch-pr-review-agent-lock.sh     # called by bootstrap.sh after gh aw compile
  #
  # Run lifecycle scripts (used by archive-run.sh, start-run.sh):
  - scripts/capture-run-data.sh
  - scripts/start-run.sh
  - scripts/archive-run.sh
  - scripts/run-lifecycle-lib.sh              # sourced by archive-run.sh, start-run.sh
  - scripts/verify-mvp.sh
  - scripts/log-decision.sh
  - scripts/monitor-pipeline.sh
  - scripts/demo-preflight.sh
  #
  # Pipeline script tests (run by CI workflow):
  - scripts/tests/test-classify-pipeline-pr.sh
  - scripts/tests/test-patch-pr-review-agent-lock.sh
  - scripts/tests/test-pr-review-agent-activation.sh

  # ── Stable documentation ──
  - docs/ARCHITECTURE.md
  - docs/SELF_HEALING_MVP.md
  - docs/why-gh-aw.md
  - docs/decision-ledger/README.md
  - docs/prd/sample-prd.md
  # Note: docs/plans/ is NOT exported. Generated repos start with no plans.
  # Plans are created at runtime by prd-planner agent or human authors.

  # ── Setup & config ──
  - README.template.md
  - setup.sh
  - setup-verify.sh
  - vercel.json
  - .gitignore
  - LICENSE

  # ── Empty directory stubs ──
  - showcase/README.md

# Files exported as rendered templates (not raw copies).
# export-scaffold.sh processes these with default values.
# setup.sh patches them further during user configuration.
render:
  autonomy-policy.yml:
    defaults:
      app_directory: src
      sensitive_directories: "auth,compliance,payments"
      last_reviewed: "YYYY-MM-DD"
  .deploy-profile:
    defaults:
      profile: nextjs-vercel
  AGENTS.md:
    defaults:
      app_directory: src
      test_framework: vitest

# Exported with a different name in the scaffold.
rename:
  README.template.md: README.md

# Guardrail: patterns that must NEVER appear in dist/scaffold/.
# Export fails hard if any match is found.
forbidden_patterns:
  - "*.env"
  - "*.pem"
  - "*.sqlite"
  - "*.db"
  - "credentials*"
  - "secret*"

# Guardrail: paths that must NEVER appear in dist/scaffold/.
# Export fails hard if any match is found.
forbidden_paths:
  - PRDtoProd/
  - PRDtoProd.Tests/
  - showcase/*
  - drills/
  - extraction/
  - trigger/
  - scaffold/
  - dist/
  - mocks/
  - docs/prd/*
  - docs/plans/ # internal migration/design docs — not exported
  - docs/run-log-*
  - .sisyphus/
  - console/    # operator UI — source-repo-only, never exported
  - Dockerfile
  - global.json
  - CLAUDE.md

# Explicit exceptions to forbidden path prefixes above.
exception_paths:
  - showcase/README.md
  - docs/prd/sample-prd.md
```

### 4.2 Lock File Policy

The source repo owns `.md` agent definitions. The export step compiles them.

| Artifact | Lives in prd-to-prod | Lives in dist/scaffold/ | Editable by |
|---|---|---|---|
| `*.md` (agent source) | Yes | Yes | Humans in prd-to-prod |
| `*.lock.yml` (compiled) | Yes | Yes (compiled during export) | `gh aw compile` only |

**Export compiles.** `export-scaffold.sh` runs `gh aw compile` inside the scaffold after copying `.md` files. The published scaffold contains both source and compiled output.

**Bootstrap can recompile.** After a user customizes agent `.md` files in their generated repo, they run `gh aw compile` (or `setup.sh` which calls it) to regenerate `.lock.yml` files.

### 4.3 Export Script (Publication)

`scaffold/export-scaffold.sh` materializes the manifest into `dist/scaffold/`:

```
export-scaffold.sh workflow:

1. Parse template-manifest.yml
2. Clean dist/scaffold/
3. Copy each `include` entry from repo root → dist/scaffold/
4. Render each `render` entry with default values → dist/scaffold/
5. Apply `rename` mappings
6. Create empty directory stubs (showcase/README.md)
7. Run gh aw compile inside dist/scaffold/ (two-pass for prd-decomposer dependency)
8. Run leak-test.sh (fail hard if forbidden paths/patterns found)
9. Run bootstrap-test.sh (create temp repo, verify setup + compile + smoke)
10. Optionally: push dist/scaffold/ to export branch or publish to separate repo
```

### 4.4 Guardrails

**Leak test** (`scaffold/leak-test.sh`):
- Walks `dist/scaffold/` and checks against `forbidden_paths` and `forbidden_patterns`
- Applies `exception_paths` first, so explicit stubs like `showcase/README.md` and
  `docs/prd/sample-prd.md` are allowed while sibling paths still fail hard
- Exits non-zero if any match is found
- Run as part of export and as a CI check on prd-to-prod

**Bootstrap test** (`scaffold/bootstrap-test.sh`):

The current `setup-verify.sh` requires `gh` auth, remote repo labels/secrets, auto-merge
settings, and an `origin` remote — a plain temp directory will fail. The bootstrap test
therefore runs a **local-only verification**, not the full `setup-verify.sh`:

1. Creates a temp directory, copies `dist/scaffold/` into it, `git init`
2. **File completeness check:** Verifies all expected files exist:
   - For every exported `.github/workflows/*.md` agent source, a matching `.lock.yml` exists
   - All workflow-referenced scripts (healing-control.sh, classify-pipeline-issue.sh, etc.)
   - Config files (.deploy-profile, autonomy-policy.yml, vercel.json)
   - Setup tooling (setup.sh, setup-verify.sh)
3. **Reference completeness check:** Parses exported workflows for script references and verifies every referenced path exists in `dist/scaffold/`. Catches the case where a workflow was exported but a script it depends on was not added to the manifest.
   - Scan `.github/workflows/*.yml` and `.github/workflows/*.lock.yml` for `sparse-checkout` path lists and `scripts/` invocations (grep for `scripts/[a-z].*\.sh`)
   - Scan `.github/workflows/*.md` agent source files for `scripts/` references in tool call patterns and instruction text
   - For each referenced path, verify it exists in `dist/scaffold/`
   - Fail hard on any missing reference, with a message naming the workflow and the missing path
   - This is the complement of the leak test: leak test prevents exporting too much, reference completeness prevents exporting too little
4. **Config validity check:** deploy profile value has a matching `.github/deploy-profiles/*.yml`
5. **Policy check:** autonomy-policy.yml has no placeholder comments (`# Replace with your`)
6. **Recompile check:** deletes all `.lock.yml` files, runs `gh aw compile` twice, verifies they regenerate
7. Cleans up

The full `setup-verify.sh` (with remote checks for labels, secrets, auto-merge, memory branch)
runs after `setup.sh` in a real generated repo — that is a user-facing verification step,
not a scaffold export gate.

**Invariant:** deleting `dist/scaffold/` and rerunning `export-scaffold.sh` reproduces it exactly. The scaffold is reconstructable from the manifest alone.

### 4.5 showcase/ in the Scaffold

An empty `showcase/README.md` is included in the scaffold. Rationale:

- `archive-run.sh` writes to `showcase/{run}/README.md` — the directory must exist
- `studio/app/api/showcase/route.ts` degrades cleanly when empty (returns `{ entries: [] }`)
- The archive lifecycle and docs treat `showcase/` as a permanent repo surface
- Forbidding it entirely would break the run lifecycle scripts

---

## 5. v2 Routing — Existing Product Mode

### 5.1 Unified Entry Point

```bash
# v1: greenfield — no TARGET_REPO, creates new repo
./extraction/run.sh

# v1: greenfield — explicit mode override
./extraction/run.sh --mode greenfield

# v2: existing product — TARGET_REPO required
TARGET_REPO=owner/repo ./extraction/run.sh

# v2: existing product — explicit mode override
TARGET_REPO=owner/repo ./extraction/run.sh --mode existing

# Auto-classify (no TARGET_REPO, no mode flag)
# If classifier returns "existing", fail fast:
#   "Classification returned 'existing' but TARGET_REPO is not set.
#    Set TARGET_REPO=owner/repo or use --mode greenfield to override."
./extraction/run.sh --mode auto
```

**Routing rules:**

| `TARGET_REPO` | `--mode` | Behavior |
|---|---|---|
| not set | omitted / `auto` | classify.sh runs. `greenfield` → v1. `existing` → fail fast with error. |
| not set | `greenfield` | skip classification, v1 path |
| not set | `existing` | fail fast: `TARGET_REPO required for existing mode` |
| set | omitted / `auto` | skip classification, v2 path (TARGET_REPO implies existing) |
| set | `greenfield` | ignore TARGET_REPO, v1 path |
| set | `existing` | skip classification, v2 path |

**Key rule:** `existing` mode always requires `TARGET_REPO`. The system never guesses where to send work.

### 5.1.1 Classifier Specification (`classify.sh`)

`classify.sh` determines whether a transcript describes a greenfield product or changes to an existing one. Because incorrect routing is unrecoverable — a greenfield classification spawns a new repo, an existing classification files issues — the classifier must be conservative and explicit about confidence.

**Inputs:**
- Transcript text (stdin or file path)
- Optional: `TARGET_REPO` (if set, classifier is skipped — existing is implied)
- Optional: `--product-registry <path>` (JSON file mapping known product names to repos)

**Heuristic signals (weighted):**

| Signal | Points toward | Weight |
|--------|--------------|--------|
| "build", "create", "new app/product/service" | greenfield | +2 |
| "add to", "update", "fix in", "change the" | existing | +2 |
| Named existing system ("the dashboard", "our API", product name) | existing | +3 |
| Version references ("v2", "next release", "current implementation") | existing | +2 |
| Repository or URL references ("the repo", "github.com/...") | existing | +3 |
| No concrete system references (abstract/aspirational discussion) | greenfield | +1 |
| Product registry match (transcript mentions a known product name) | existing | +4 |

**Confidence scoring:**

```
score = sum(existing_signals) - sum(greenfield_signals)
```

| Score range | Classification | Confidence |
|-------------|---------------|------------|
| score >= 5 | existing | high |
| 2 <= score < 5 | existing | low |
| -1 <= score < 2 | greenfield | low |
| score < -1 | greenfield | high |

**Output:**
```json
{
  "classification": "greenfield | existing",
  "confidence": "high | low",
  "signals": ["signal 1", "signal 2"],
  "product_match": "owner/repo | null"
}
```

**Routing behavior by confidence:**

| Confidence | Classification | `TARGET_REPO` | Behavior |
|------------|---------------|---------------|----------|
| high | greenfield | not set | v1 path |
| high | existing | not set | fail fast: "Classification returned 'existing' but TARGET_REPO is not set." If `product_match` is present, include it in the error as a suggested `TARGET_REPO=owner/repo` value. |
| low | greenfield | not set | default to greenfield, log warning: "Low confidence classification — defaulting to greenfield. Set TARGET_REPO to override." |
| low | existing | not set | default to greenfield, log warning: "Low confidence 'existing' classification without TARGET_REPO — defaulting to greenfield." If `product_match` is present, include it as a suggested `TARGET_REPO=owner/repo` value. |
| any | any | set | skip classifier, v2 path |

**Key invariant:** Existing-product routing always requires explicit `TARGET_REPO`. Classifier output may suggest a repo via `product_match`, but it never routes work on its own. Low-confidence classifications always default to greenfield. The system never silently routes to an existing repo.

**Implementation:** Pattern matching (grep + scoring), not LLM. Must be fast, deterministic, and auditable. The product registry is optional — without it, the classifier relies on transcript signals alone, which means low-confidence existing classifications will always default to greenfield. With it, the classifier can surface a concrete `TARGET_REPO` suggestion in logs or operator UI, but the caller must still opt in by setting `TARGET_REPO`.

### 5.2 Issue Extraction (v2)

`extraction/extract-issues.sh`:

1. Fetch transcript (WorkIQ or mock — same input layer as v1)
2. Send to LLM with `prompt-issues.md`
3. LLM returns structured JSON array
4. Validate output
5. Pass to `trigger/push-to-existing.sh`

**`prompt-issues.md`** instructs the LLM to:
- Extract actionable work items from a meeting transcript about an existing product
- Classify each into the canonical pipeline issue types: `feature`, `bug`, `infra`, `docs`, or `test`
- Default product changes to `feature` or `bug`; use `infra`, `docs`, or `test` only when the transcript explicitly describes that class of work
- Preserve exact requirements from the transcript (endpoint names, field names, error descriptions)
- Emit dependency order (infrastructure before features, features before polish)

### 5.2.1 LLM Output Schema Validation

All LLM outputs are validated against JSON schemas via `extraction/validate-schema.sh` (Python `jsonschema`). Schema files live in `extraction/schemas/`:

| Schema | Validates output of |
|--------|-------------------|
| `issues-output.json` | `extract-issues.sh` |
| `gap-item.json` | `analyze-target.sh` (per-requirement) |
| `file-selector-output.json` | `analyze-target.sh` Stage 1 |
| `validation-result.json` | `validate-deployment.sh` |

**Canonical example** (`issues-output.json`):

```json
{
  "type": "array", "minItems": 1,
  "items": {
    "type": "object",
    "required": ["type", "title", "description", "acceptance_criteria"],
    "properties": {
      "type": { "enum": ["feature", "bug", "test", "infra", "docs"] },
      "title": { "type": "string", "minLength": 5 },
      "description": { "type": "string", "minLength": 20 },
      "acceptance_criteria": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 10 } },
      "dependencies": { "type": "array", "items": { "type": "integer" } }
    }
  }
}
```

**Retry policy:** On validation failure, retry the LLM call once with the validation error appended to the prompt. If the retry also fails, use a fallback (empty enrichment / error issue). The pipeline never halts on schema validation failure.

**Integration points:** `extract-issues.sh` validates before passing to `analyze-target.sh`; `analyze-target.sh` validates each GapItem; `validate-deployment.sh` validates its result.

**Existing validation retained:** `validate.sh` (grep-based PRD markdown validation) continues to serve the v1 path alongside schema validation.

### 5.3 Gap Analysis Against Target Repo

Before filing issues, the pipeline analyzes the target repo to understand what already exists. This produces enriched issues that cite specific files and line ranges — giving `repo-assist` a head start on implementation.

**Adapted from** [meeting-2-code](https://github.com/danielmeppiel/meeting-2-code) (MIT license) — their ANALYZE phase browses a repo via GitHub MCP and produces per-requirement gap analysis. We adapt this as shell + OpenRouter API calls (no Copilot SDK dependency).

#### GapItem Schema

```json
{
  "requirement": "string",
  "currentState": "string — cites specific files + line ranges",
  "gap": "string — what's missing or 'No gap'",
  "complexity": "Low | Medium | High | Critical",
  "estimatedEffort": "string",
  "details": ["step 1", "step 2"]
}
```

#### Two-Stage Analysis Pipeline (`analyze-target.sh`)

**Stage 1 — File Selection (fast model, ~30s):**
1. Resolve target ref:
   - If `TARGET_REF` is set, use it
   - Otherwise fetch repo metadata via `gh api repos/$TARGET_REPO --jq .default_branch`
2. Fetch full file tree via `gh api repos/$TARGET_REPO/git/trees/$TARGET_REF?recursive=1`
3. Filter to source files (exclude .git/, node_modules/, lock files, binaries)
4. Send tree + requirement to fast model (`anthropic/claude-sonnet-4-6`) with `prompt-file-selector.md`
5. Model returns JSON array of 5–10 relevant file paths

**Stage 2 — Gap Analysis (strong model, ~120s):**
1. Fetch selected files via `gh api repos/$TARGET_REPO/contents/<path>?ref=$TARGET_REF` (base64 decode)
2. Truncate files > 500 lines with `[... truncated]` marker; total budget ~100k chars
3. Send requirement + file contents to strong model (`anthropic/claude-opus-4-6`) with `prompt-gap-analysis.md`
4. Model returns GapItem JSON

**Parallelism:** Bounded worker pool (max 4, configurable via `GAP_ANALYSIS_WORKERS`). Background jobs with `wait -n` throttling. Same pattern as meeting-2-code's Promise.all worker pool.

**Error Handling:** Per-requirement isolation. Failed analysis → fallback GapItem (`currentState: "Analysis failed"`, `complexity: "Unknown"`). Pipeline continues even if ALL analyses fail — issues are created without enrichment.

#### Script Interface

```bash
# Input: $1 = path to requirements JSON file, TARGET_REPO env var
# Output: enriched JSON to stdout (each item gains "gapAnalysis" field)
# Env: OPENROUTER_API_KEY (required), GAP_ANALYSIS_WORKERS (default 4),
#       GAP_ANALYSIS_FAST_MODEL, GAP_ANALYSIS_STRONG_MODEL, GAP_ANALYSIS_TIMEOUT,
#       TARGET_REF (optional; defaults to repo default branch)
```

#### Shell Conventions

`analyze-target.sh` follows established patterns:
- `set -euo pipefail`, `SCRIPT_DIR`/`PROJECT_ROOT` from `$0` (same as `push-to-pipeline.sh`)
- `log()` / `fail()` helpers (same as `push-to-pipeline.sh`)
- Python for prompt assembly + JSON handling (avoids bash expansion corruption — see MEMORY.md)
- `curl` for OpenRouter API calls (same pattern as `extract-prd.sh`)
- `jq` for JSON manipulation
- `mktemp -d` for work dir with `trap` cleanup (same as `push-to-pipeline.sh`)

#### Prompt Specifications

**`prompt-file-selector.md`** (Stage 1): Instructs LLM to select 5–10 relevant source files from a repo tree given a requirement. Returns JSON array of file paths. Prefers source over config/tests/docs. No explanation, just the array.

**`prompt-gap-analysis.md`** (Stage 2): Adapted from meeting-2-code's gap analyzer prompt (MIT). Instructs LLM to analyze a requirement against actual file contents. Must cite specific files + line ranges. Returns GapItem JSON matching the schema above. Complexity rubric: Low (1–2 files), Medium (3–5 files), High (new subsystems), Critical (architectural changes).

### 5.4 v2 Issue Shape

v2 issues must match the shape that `repo-assist` and `prd-decomposer` already expect. This means matching the exact sections from `prd-decomposer.md` output:

```markdown
# [Pipeline] <title>

## PRD Traceability
- **Source:** Meeting transcript <meeting-id> (<date>)
- **Source Sections:** <relevant discussion topics>
- **Normative Requirements In Scope:**
  - <exact requirement from transcript>
  - <exact requirement from transcript>

## Description
<what to build/fix and why, with context from the meeting>

## Acceptance Criteria
- [ ] <criterion — self-contained, references only this issue's artifacts>
- [ ] <criterion>

## Dependencies
<"None" or "Depends on #N" if ordering matters>

## Technical Notes

### Current State
<gapItem.currentState — cites specific files and line ranges>

### Gap
<gapItem.gap — what is missing or needs to change>

### Complexity
<gapItem.complexity> — Estimated effort: <gapItem.estimatedEffort>

### Implementation Steps
1. <gapItem.details[0]>
2. <gapItem.details[1]>
```

> **Note:** When gap analysis fails or is skipped, Technical Notes falls back to a generic placeholder (`<relevant file paths, API signatures, architectural guidance if known>`). Enrichment is transparent to downstream consumers — `repo-assist` reads Technical Notes regardless of how it was populated.

**Labels:** Each issue gets `pipeline` + one of `feature`, `bug`, `test`, `infra`, `docs`.

**Title prefix:** `[Pipeline]` — required for `pr-review-submit.yml` to recognize pipeline PRs.

### 5.4.1 Native Sub-Issue Linking

After creating child issues, link them to the parent using GitHub's sub-issue API:

```
POST /repos/{owner}/{repo}/issues/{parent}/sub_issues
{ "sub_issue_id": <child_node_id> }
```

**v1 path:** `activate-decomposed-issues.yml` links each decomposed issue to the root PRD issue.

**v2 path:** `push-to-existing.sh` creates a tracking epic first (`[Pipeline] Meeting: <title> (<date>)` with labels `pipeline,prd`), then links each child issue to it.

**Node ID retrieval:**
```bash
gh api graphql -f query='{ repository(owner:"...",name:"...") { issue(number:N) { id } } }' \
  --jq '.data.repository.issue.id'
```

**Benefits:** GitHub UI shows completion %, sub-issues appear in sidebar, `pipeline-status` can query the API for progress. Body-text `## Dependencies` is retained for build ordering (hierarchy ≠ build order).

**Fallback:** If the sub-issue API fails (preview/plan limitation), log a warning and continue. Body-text references still provide sufficient traceability.

### 5.5 Idempotency

Each v2 issue includes an idempotency marker in the body:

```markdown
<!-- meeting-to-main:transcript-hash:<sha256> -->
<!-- meeting-to-main:item-index:<N> -->
```

`push-to-existing.sh` checks for existing open issues with the same transcript hash before creating duplicates. This prevents duplicate issue bursts if the extraction runs twice on the same transcript.

### 5.6 What Doesn't Change

The entire downstream pipeline is untouched:

- `auto-dispatch.yml` — already handles any `[Pipeline]` + type-labeled issue
- `repo-assist` — already sorts by dependency order from issue body, implements features, fixes bugs
- `pr-review-agent` — already reviews against acceptance criteria
- `pr-review-submit.yml` — already parses verdicts and arms auto-merge
- `deploy-router.yml` — already deploys on merge
- Self-healing loop — already repairs CI failures
- `pipeline-watchdog.yml` — already detects stalls

v2 issues look exactly like v1 decomposed issues to the pipeline. The only difference is how they were created.

> **Caveat:** The downstream pipeline gains one new step: `validate-deployment.yml` runs between deploy and close-issues (see §5.7). `close-issues.yml` is gated on validation passing. For issues where the deployed app is not directly testable (infra, refactoring), validation is skipped based on issue labels.

### 5.7 Post-Deployment Validation (VALIDATE Phase)

The pipeline currently assumes "deployed = done." In practice, deployment can succeed while requirements remain unmet (wrong response shapes, missing endpoints, partial implementations). The VALIDATE phase closes this gap with adversarial post-deploy verification.

#### 5.7.1 Trigger

New workflow `validate-deployment.yml` is dispatched by `deploy-router.yml` after a successful deploy. Receives: deployment URL, source issue number(s), repo. Slots between "deploy" and "close-issues." If validation fails, the issue is NOT closed — a repair issue is filed instead.

#### 5.7.2 Two-Phase Evidence Collection

**Phase 1 (Deterministic):** `curl` fetches the deployed URL. Collects:
- HTTP status codes for API endpoints (extracted from acceptance criteria)
- Response body JSON structure via `jq`
- Content-Type headers
- Response times
- For frontend routes: HTML content, grep for expected DOM elements

**Phase 2 (AI Verification):** Per acceptance criterion:
1. Decompose into atomic claims
2. Feed each claim + Phase 1 evidence to OpenRouter (Claude Sonnet) with adversarial QA prompt
3. PASS/FAIL per claim with evidence citation
4. All claims must pass for the criterion to pass

#### 5.7.3 ValidationResult Schema

```json
{
  "deploymentUrl": "string",
  "issueNumbers": ["number"],
  "requirements": [{
    "criterion": "string",
    "atomicClaims": [{
      "claim": "string",
      "status": "PASS | FAIL",
      "evidence": "string",
      "reasoning": "string"
    }],
    "overallStatus": "PASS | FAIL"
  }],
  "overallVerdict": "PASS | FAIL",
  "failedCount": "number",
  "totalCount": "number"
}
```

#### 5.7.4 Script Interface

```bash
# extraction/validate-deployment.sh
# Input: DEPLOYMENT_URL, ISSUE_NUMBERS (comma-separated), REPO
# Output: ValidationResult JSON to stdout
# Env: OPENROUTER_API_KEY, VALIDATE_TIMEOUT (default 300s)
# Exit: 0 = all pass, 1 = failure, 2 = infrastructure error
```

#### 5.7.5 Failure Recovery

1. Post validation report as comment on source issue
2. Create `[Pipeline] Validation Failure: <title>` issue (labels `pipeline` + `bug`)
3. Auto-dispatch routes to repo-assist for repair
4. Creates a closed loop: deploy → validate → fail → repair → re-deploy → re-validate
5. Max 2 retries per failed criterion (`VALIDATE_MAX_RETRIES`), then escalate with `needs-human` label

**Retry state storage:** Retry counts are tracked per criterion via a reserved HTML comment block in the source issue body, updated deterministically by `validate-deployment.yml`:

```markdown
<!-- validation-state:{"retryCounts":{"criterion-1":1,"criterion-2":0},"lastAttempt":"2026-03-07T14:30:00Z","lastVerdict":"FAIL","failedCriteria":["criterion-1"]} -->
```

`criterion-*` identifiers are stable hashes derived from normalized acceptance-criterion text. The workflow reads this block before each validation attempt, increments only the counts for criteria that failed in the latest run, and writes the updated block back via `gh api` PATCH. This is a single atomic read-modify-write per attempt. The block is:
- **Machine-owned:** only `validate-deployment.yml` reads or writes it. Other automation ignores it.
- **Deterministic:** `retryCounts[criterionId]` is the sole input to the max-retries check for that criterion. No parsing of comment threads.
- **Queryable:** `gh api` can read the issue body and extract the block via `jq` + regex.
- **Collision-safe:** uses a reserved prefix (`validation-state:`) that no other pipeline component writes.

If the block is missing (first run), it is created with an empty `retryCounts` object. If the block is malformed, the workflow treats it as empty state and overwrites it.

**Escalation rule:** A validation repair loop continues while every failing criterion has `retryCounts[criterionId] < VALIDATE_MAX_RETRIES`. Once any still-failing criterion reaches the limit, validation stops retrying automatically and the source issue is labeled `needs-human`.

#### 5.7.6 Validation Contract and Scope

**What v1 validation covers:**
- HTTP status codes for API endpoints referenced in acceptance criteria
- Response body JSON structure and field presence via `jq`
- Content-Type headers
- HTML content grep for expected text, DOM elements, and meta tags on frontend routes
- Response time thresholds (warning, not failure)

**What v1 validation does NOT cover (documented non-goals):**
- Frontend behavioral correctness: interactive elements, client-side routing, JavaScript-dependent rendering, visual layout
- Visual regression: screenshot comparison, pixel-level rendering
- Performance benchmarks: load testing, Lighthouse scores, Core Web Vitals
- Authentication flows: multi-step auth sequences requiring session state

**Implication for acceptance criteria:** PRD authors and `prd-decomposer` should write acceptance criteria that are verifiable at the HTTP/HTML level. Criteria like "button submits form and shows success message" are not verifiable by v1 validation — prefer "POST /api/submit returns 200 with `{ success: true }`" and "GET / response contains `<form id=\"submit-form\">`". When acceptance criteria require behavioral verification, the validation phase will produce false positives (criteria marked PASS based on static content presence, not runtime behavior). This is a known limitation until Playwright integration.

**Frontend visual validation (Playwright) is deferred** — the shell pipeline can't run a headless browser without significant infrastructure. Performance validation is also deferred.

#### 5.7.7 Shell Conventions

Same as `analyze-target.sh`: `set -euo pipefail`, `SCRIPT_DIR`/`PROJECT_ROOT`, `log()`/`fail()` helpers, Python for prompt assembly + JSON handling, `curl` for OpenRouter, `jq` for JSON, `mktemp -d` with `trap` cleanup.

#### 5.7.8 New Prompt

`extraction/prompt-validate-claim.md` — adversarial QA agent. System prompt: "You are an extremely strict QA tester. Decompose the acceptance criterion into atomic claims. For each claim, check the provided evidence. FAIL the criterion if even ONE claim is unmet. Do not speculate — only use the evidence provided."

### 5.8 Error Classification for CI Failures

CI failures currently all route to repo-assist indiscriminately. An auth failure (agent can't fix secrets) gets the same treatment as a test failure (agent can fix code). Classification enables smarter routing.

#### Failure Taxonomy

| Category | Signal | Recovery |
|----------|--------|----------|
| `test-failure` | Test runner exit code, "FAIL" | repo-assist (fix code) |
| `build-failure` | Compiler errors, "error TS" | repo-assist (fix code) |
| `lint-failure` | ESLint/Prettier errors | repo-assist (low priority) |
| `dependency-failure` | npm install failures | Retry once, then repo-assist |
| `auth-failure` | 401/403, "credentials", "token" | Escalate `needs-human` (agent can't fix secrets) |
| `rate-limit` | 429, "rate limit", "quota exceeded" | Retry with backoff (15m, 30m, 60m) |
| `timeout` | Actions timeout | Retry once, then repo-assist |
| `infrastructure` | GitHub API 5xx, "ECONNREFUSED" | Retry with backoff, escalate after 3 attempts |
| `unknown` | No pattern match | repo-assist with full context |

#### Classification Script

`scripts/classify-ci-failure.sh` — pattern matching (grep + case), NOT LLM. Must be fast and deterministic.

```bash
# Input: CI log (stdin or file), workflow name, exit code
# Output: JSON to stdout
# {
#   "category": "test-failure",
#   "confidence": "high",
#   "recovery": "repo-assist",
#   "retryable": false,
#   "maxRetries": 0
# }
```

#### Integration

- `ci-failure-issue.yml` calls classifier before issue creation
- Issue title includes category: `[Pipeline] CI Failure (test-failure): <title>`
- Issue labels include `ci-<category>` (e.g., `ci-auth-failure`)
- `auto-dispatch.yml` reads category label for routing:
  - `ci-auth-failure` → `needs-human`
  - `ci-rate-limit` / `ci-timeout` / `ci-infrastructure` → retry with backoff
  - All others → repo-assist

#### Retry Tracking

Retry count is tracked via a reserved HTML comment block in the CI failure issue body, not by parsing comments:

```markdown
<!-- ci-retry-state:{"retryCount":1,"lastAttempt":"2026-03-07T15:00:00Z","category":"rate-limit"} -->
```

`ci-failure-issue.yml` and the retry workflow update this block via `gh api` PATCH. This keeps retry state deterministic, queryable, and isolated from unrelated human or automation comments.

---

## 6. Migration Plan (High-Level)

**Execution status as of 2026-03-11:** The repo has completed the core consolidation work, scaffold export, v2 issue routing, gap-analysis wiring, schema validation, sub-issue linking, and deterministic CI failure classification. Local contract verification is green via `bash scripts/verify-v2-contracts.sh`. The major remaining slices are post-deploy validation (`validate-deployment.yml` + deploy/close gating), category-aware downstream routing in `auto-dispatch.yml`, live end-to-end smoke tests against a real target repo/deployment, and the operator console.

### Phase 1: Create the single maintained source repo
- [x] Move `extraction/`, `trigger/`, `mocks/` into prd-to-prod
- [x] Port scaffold-only assets from the legacy template repo into prd-to-prod:
  `studio/`, `setup.sh`, `setup-verify.sh`, `README.template.md`, and any
  template-owned docs/config needed by the exported scaffold
- [ ] Verify v1 greenfield flow works end-to-end from the consolidated repo
- [ ] Archive meeting-to-main repo

### Phase 1b: Operator Console
- [ ] Create `console/` directory with server, orchestrator, routes, and static files
- [ ] Add `console/` to `scaffold/template-manifest.yml` forbidden_paths
- [ ] Wire orchestrator to spawn `extraction/extract-prd.sh` for v1 mode
- [ ] Test: operator starts console, fills form, sees PRD extraction stream in browser
- **Prerequisite:** Phase 1 complete (`extraction/` and `trigger/` must be in prd-to-prod)
- **Independent of:** Phase 2 (scaffold export) and Phase 3 (v2 routing)
- Console gains v2 support (mode toggle, target repo input, gap analysis rendering) in Phase 3 after v2 routing is built

### Phase 2: Build scaffold export and retarget bootstrap
- [x] Create `scaffold/template-manifest.yml`
- [x] Create `scaffold/export-scaffold.sh`
- [x] Create `scaffold/leak-test.sh` and `scaffold/bootstrap-test.sh`
- [x] Add `render` support for `autonomy-policy.yml`, `.deploy-profile`, `AGENTS.md`
- [x] Verify exported scaffold matches current legacy template contents
- [x] Adapt `push-to-pipeline.sh` to seed from `dist/scaffold/` instead of the legacy template source
- [ ] Keep a temporary fallback to the legacy template source only until scaffold smoke runs pass
- [ ] Archive prd-to-prod-template repo

### Phase 3: Build v2 routing
- [x] Create `extraction/run.sh` (unified entry point with `--mode` and `TARGET_REPO`)
- [x] Create `extraction/classify.sh`
- [x] Create `extraction/extract-issues.sh` and `extraction/prompt-issues.md`
- [x] Create `extraction/analyze-target.sh` (two-stage gap analysis orchestrator)
- [ ] Create `extraction/prompt-file-selector.md` (Stage 1 prompt)
- [ ] Create `extraction/prompt-gap-analysis.md` (Stage 2 prompt, adapted from meeting-2-code MIT)
- [x] Wire into `extraction/run.sh` between extract-issues and push-to-existing
- [x] Create `trigger/push-to-existing.sh` with idempotency checks
- [ ] Test v2 flow against a real repo with WorkIQ transcript
- [ ] Test gap analysis against a real repo with known structure
- [x] Test degraded mode: pipeline completes when analysis fails or times out
- [x] Create `extraction/schemas/` with JSON schema files for all LLM outputs
- [x] Create `extraction/validate-schema.sh` (generic JSON schema validation helper)
- [x] Wire schema validation into extract-issues.sh, analyze-target.sh
- [x] Create `extraction/validate-deployment.sh` (evidence collection + AI verification)
- [ ] Create `extraction/prompt-validate-claim.md` (adversarial QA prompt)
- [ ] Create `.github/workflows/validate-deployment.yml` (dispatched by deploy-router)
- [ ] Wire close-issues.yml to gate on validation pass
- [x] Create `scripts/classify-ci-failure.sh` (deterministic failure classifier)
- [x] Update ci-failure-issue.yml to call classifier, add category to title/labels
- [ ] Update auto-dispatch.yml for category-aware routing
- [x] Update `push-to-existing.sh` for sub-issue linking
- [ ] Update `activate-decomposed-issues.yml` for sub-issue linking parity
- [ ] Test validation against a deployed smoke app with known acceptance criteria
- [ ] Test degraded mode: pipeline completes when validation infrastructure fails
- [x] Test error classification with sample CI failure logs from each category
- [ ] Wire orchestrator to spawn `extraction/run.sh` for unified v1/v2 mode
- [ ] Add v2-specific progress rendering (gap analysis rows, per-requirement progress)
- [ ] Add target repo input and mode toggle to form

### Phase 4: CI integration
- [x] Add scaffold export as a CI step on prd-to-prod pushes to main
- [x] Leak test runs on every PR
- [x] Bootstrap test runs on scaffold-relevant file changes
- [ ] Optionally: auto-publish scaffold to export branch or separate repo on green

---

## 7. What Gets Archived

| Repo | Action | Reason |
|---|---|---|
| meeting-to-main | Archive after Phase 1 | Absorbed into prd-to-prod as extraction/ + trigger/ |
| prd-to-prod-template | Archive after Phase 2 | Legacy migration input replaced by scaffold export artifact |
| prd-to-prod | Remains — single source of truth | Product + pipeline + extraction + scaffold export |

---

## 8. Success Criteria

- [x] Single repo (prd-to-prod) contains all pipeline infrastructure
- [x] `scaffold/export-scaffold.sh` produces a scaffold that passes leak test + bootstrap test
- [ ] v1 greenfield flow works end-to-end from consolidated repo (transcript → deployed app)
- [x] v2 existing-product flow creates properly shaped issues in target repo
- [ ] v2 issues trigger auto-dispatch and complete through repo-assist → review → merge → deploy
- [ ] No manual sync between repos — editing a workflow in prd-to-prod is the only action needed
- [x] Scaffold is reconstructable: delete dist/scaffold/, rerun export, get identical output
- [ ] Gap analysis enriches v2 issues with specific file citations from target repo
- [x] Gap analysis degrades gracefully: pipeline completes even when all analyses fail
- [ ] Post-deployment validation runs automatically after deploy-router succeeds
- [ ] Validation failures create repair issues that re-enter the pipeline
- [ ] Validation degrades gracefully: pipeline completes when validation infra fails
- [x] LLM output schema validation catches malformed output before downstream corruption
- [ ] CI failure classification routes auth/infra errors differently from code errors
- [x] Sub-issues are natively linked to parent via GitHub API (with body-text fallback)
- [ ] Non-technical user can trigger v1 pipeline from browser without touching terminal
- [ ] Real-time SSE streaming shows pipeline progress stage-by-stage
- [ ] Preflight checks prevent launch when required credentials are missing
- [ ] Console is excluded from scaffold export (forbidden_paths)

---

## 9. Operator Console

### 9.1 Purpose

The console is a browser-based operator UI for triggering and monitoring pipeline runs. Target users: product managers and team leads who had the meeting but don't use terminals. It is a thin presentation layer over the existing shell pipeline — the scripts remain the execution engine.

### 9.2 Architecture

```
console/
├── server.js                    # Express, binds localhost:3000
├── package.json                 # express only
├── lib/
│   ├── orchestrator.js          # Spawns shell scripts, parses stdout, emits events
│   ├── event-store.js           # Per-run event buffer + EventEmitter for SSE
│   └── preflight.js             # Checks env vars + command availability
├── routes/
│   ├── api-preflight.js         # GET /api/preflight
│   ├── api-run.js               # POST /api/run → { runId }, GET /api/run/:id
│   ├── api-run-stream.js        # GET /api/run/:id/stream (SSE)
│   └── api-history.js           # GET /api/history
├── public/
│   ├── index.html               # Landing page (form + preflight)
│   ├── run.html                 # Progress page (SSE consumer)
│   ├── history.html             # Past runs table
│   ├── css/console.css
│   └── js/
│       ├── app.js               # Client routing
│       ├── preflight.js         # Preflight UI
│       ├── run-form.js          # Form handling
│       ├── run-progress.js      # SSE consumer + stage visualization
│       └── history.js           # History table
└── data/                        # Created at runtime, gitignored
    └── .gitkeep
```

**Relationship to `studio/`:** Siblings, not parent-child. Studio is exported to generated repos (dashboard for pipeline status). Console is source-repo-only (operator control plane). No shared code at runtime. Visual consistency via shared CSS custom properties.

### 9.3 User Journey

**Landing page (`/`):**
1. Preflight checks display on load (green/red per item): `OPENROUTER_API_KEY`, `gh` auth, `COPILOT_GITHUB_TOKEN`, `VERCEL_TOKEN`, WorkIQ
2. **Input source toggle**: `WorkIQ query` or `Notes / raw text`
3. If `WorkIQ query`: **Meeting name/query** input (free text)
4. If `Notes / raw text`: large textarea for pasted notes, transcript fragments, or a short project blurb
5. **Mode toggle** (New Product / Existing Product)
6. If Existing Product: **Target repo** input (`owner/repo`)
7. Mock mode checkbox (offline dev — uses `mocks/` fixtures)
8. **"Ship the Meeting"** button (disabled if preflight fails)

**Console input contract:** WorkIQ is preferred when explicitly selected and configured, but it is not required. The operator can always paste plain meeting notes, bullet points, or raw transcript text. The console passes that text directly to `extract-prd.sh` / `run.sh` without requiring WorkIQ-shaped structure.

**Progress page (`/run/:id`):**

4-stage pipeline visualization (adapted from Daniel's Meet → Analyze → Build → Verify):

| Stage | Label | Shell script | What streams to UI |
|-------|-------|-------------|-------------------|
| 1 | EXTRACT | `extract-prd.sh` (v1) or `extract-issues.sh` (v2) | `[1/3] Fetching...`, `[2/3] Extracting PRD...`, `PRD written to`, `PRD validation passed` |
| 2 | ANALYZE | `validate.sh` (v1) or `analyze-target.sh` (v2) | Validation checks (v1); per-requirement gap rows with complexity badges (v2) |
| 3 | BUILD | `push-to-pipeline.sh` (v1) or `push-to-existing.sh` (v2) | `Creating repo...`, `Configuring secrets...`, `Compiling agents...` (streams `gh aw compile` two-pass output + lock file verification: `repo-assist.lock.yml ✓`), `Created issue #N` |
| 4 | VERIFY | `gh api` polling of Actions runs | Live agent execution graph: decompose → implement → review → auto-merge → deploy (see below) |

**Agent execution graph (VERIFY stage):** After BUILD completes and `/decompose` fires, the orchestrator switches from `child_process.spawn` (local shell) to `gh api repos/{repo}/actions/runs` polling (remote Actions). It maps compiled workflow names to pipeline stages:

| Workflow run | Console renders as |
|---|---|
| `prd-decomposer.lock.yml` | "Decomposing PRD into sub-issues..." |
| `repo-assist.lock.yml` | "Implementing [Pipeline] \<title\>..." |
| `pr-review-agent.lock.yml` | "Reviewing PR #N..." |
| `deploy-vercel.yml` | "Deploying to Vercel..." |
| `validate-deployment.yml` | "Verifying requirements..." |

Each workflow run emits SSE events: `workflow_queued`, `workflow_in_progress`, `workflow_completed`, `workflow_failed`. The console renders these as a waterfall timeline showing the full agent lifecycle — from PRD decomposition through deployed and verified.

**Why this is unique:** Daniel's `meeting-2-code` console goes dark after assigning the Copilot coding agent. SDK agent sessions are ephemeral local processes with no query interface. Our pipeline's gh-aw workflows run in GitHub Actions, making every agent execution step queryable via API. The console makes this observability tangible.

**Activity log panel:** Real-time scrolling log of raw events. Timestamps + level (info/warn/error). The "debug view" for operators who want full visibility.

**Error handling:** Failed stage turns red with error message. "Retry" button re-runs from failed stage.

**History page (`/history`):** Table of past runs (ID, timestamp, mode, meeting name, status, link).

### 9.4 Real-Time Streaming (Shell → SSE → Browser)

**Execution bridge:**
```
Browser  ←SSE→  Express server  ←spawn→  Shell script
EventSource      res.write()              stdout/stderr
  onmessage ←── 'data: {...}\n\n' ←────  log lines
```

1. `POST /api/run` saves metadata, spawns orchestrator process, returns `{ runId }` immediately
2. Orchestrator spawns shell scripts as child processes, reads stdout line-by-line via `readline`
3. Pattern matching converts raw output to structured events:
   - `[N/M] <message>` → `{ type: "progress", step: N, total: M, message }`
   - `[meeting-to-main] <message>` → `{ type: "log", level: "info", message }`
   - `[meeting-to-main] ERROR:` → `{ type: "log", level: "error" }`
   - `PIPELINE_REPO=<value>` → `{ type: "artifact", key: "pipeline_repo", value }`
   - `PIPELINE_ISSUE_URL=<value>` → `{ type: "artifact", key: "issue_url", value }`
4. Events buffer in memory; `GET /api/run/:id/stream` replays + subscribes to new events

**Shell scripts do NOT change.** The orchestrator adapts to their existing output format.

**SSE event schema:**
```json
{
  "id": "evt-001",
  "stage": "EXTRACT | ANALYZE | BUILD | VERIFY",
  "type": "stage_start | progress | log | artifact | stage_complete | stage_error | run_complete | run_error | workflow_status | pr_created | review_verdict | auto_merge | deploy_complete",
  "data": { ... },
  "timestamp": "ISO-8601"
}
```

**VERIFY-stage event types** (from `gh api` polling, not shell stdout):
```json
{ "type": "workflow_status", "data": { "workflow": "repo-assist.lock.yml", "status": "in_progress", "run_url": "..." } }
{ "type": "pr_created", "data": { "number": 3, "title": "...", "url": "..." } }
{ "type": "review_verdict", "data": { "verdict": "approve", "pr": 3 } }
{ "type": "auto_merge", "data": { "pr": 3, "sha": "..." } }
{ "type": "deploy_complete", "data": { "url": "https://...", "status": "success" } }
```

### 9.5 Authentication

Pre-configured on server via `~/.env` (same source `extract-prd.sh` already uses). No login flow — single-operator tool.

- Console reads `~/.env` on startup, passes env to spawned shell scripts
- Preflight endpoint returns `{ name, present: true/false }` — never exposes actual values
- Server binds `localhost` only — no network exposure
- WorkIQ device-code auth: orchestrator detects the Entra ID URL+code pattern in stderr, surfaces as `auth_required` SSE event so operator can complete flow in browser

### 9.6 Scaffold Export

`console/` added to `scaffold/template-manifest.yml` under `forbidden_paths`. Console is never exported to generated repos.

### 9.7 Why gh-aw (Not the Copilot SDK)

The console triggers a pipeline whose downstream execution is powered by gh-aw compiled agent workflows. This architectural choice enables the console's VERIFY stage — the most differentiated feature vs SDK-based approaches like Daniel's `meeting-2-code`.

**Observability.** Every agent workflow compiles from Markdown to a GitHub Actions YAML lock file. When the agent runs, it's a standard Actions workflow run — queryable via `gh api repos/{repo}/actions/runs`, with logs, timing, status, and artifacts. The console polls this API to render a live execution graph. SDK agent sessions run as local processes with no standard query interface — Daniel's console goes dark after assigning the coding agent.

**Auditability.** The compiled `.lock.yml` files are committed to the repo. `git diff` shows exactly what changed between agent versions. The console's BUILD stage streams the `gh aw compile` output, making the Markdown→YAML transformation visible in real-time. SDK agents are defined in imperative code — changes are harder to audit.

**Security.** gh-aw workflows run in a sandbox: tool allowlist, read-only default, write operations only through explicit `safe-outputs` declarations with rate limits. Daniel's SDK auto-approves all MCP tool invocations (`onPermissionRequest: () => "approve"`). The console's preflight check verifies that `gh aw` is installed and lock files are fresh.

**Full autonomy.** The pipeline achieves auto-merge without human gates: pr-review-agent posts a `[PIPELINE-VERDICT]`, pr-review-submit.yml parses it into a formal GitHub review, and auto-merge triggers on approval. The Copilot coding agent requires human approval to merge. The console's VERIFY stage visualizes this full autonomous lifecycle end-to-end.
