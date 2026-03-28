# V2 Consolidation Implementation Plan

> Goal: execute the consolidation from three repos to one source repo with an exported scaffold, while preserving the current greenfield lane and adding existing-product routing.

**Primary source repo:** `/Users/skahessay/Documents/Projects/active/prd-to-prod`  
**Ingress repo to absorb:** `/Users/skahessay/Documents/Projects/active/meeting-to-main`  
**Template repo to retire:** `/Users/skahessay/Documents/Projects/active/prd-to-prod-template`

**Design input:** `docs/plans/2026-03-07-v2-consolidation-design.md` must be copied into `prd-to-prod/docs/plans/` before Phase 1 starts.

## Execution Rules

1. Preserve the current greenfield path until scaffold export parity is proven.
2. Do not archive `meeting-to-main` or `prd-to-prod-template` until their replacement paths have passed smoke runs.
3. Keep work bisectable: one phase or one tightly related task group per PR.
4. Prefer additive cutover first, deletion second. New path lands beside old path until validated.
5. Every phase ends with explicit exit criteria and a rollback boundary.

## Deliverables

- Canonical consolidation design doc in `prd-to-prod/docs/plans/`
- Updated `prd-to-prod/docs/ARCHITECTURE.md` describing the target-state system
- Canonical scaffold inputs living in `prd-to-prod`
- `scaffold/` export tooling that materializes `dist/scaffold/`
- Greenfield provisioning switched from template repo to exported scaffold
- Existing-product v2 routing (`TARGET_REPO` path)
- CI checks for scaffold export, leak test, and bootstrap test
- Decommission plan executed for the two retired repos

## PR Breakdown

- PR 1: Canonical docs and scaffold-surface audit
- PR 2: Port template-only scaffold assets into `prd-to-prod`
- PR 3: Implement scaffold export, leak test, and bootstrap test
- PR 4: Migrate `meeting-to-main` into `prd-to-prod` and restore greenfield parity
- PR 5: Add existing-product v2 routing
- PR 6: Add CI publication/invariants and remove temporary fallbacks
- PR 7: Archive old repos and finalize cleanup

## Phase 0: Canonical Docs And Baseline Audit

### Task 0.1: Copy the consolidation design doc into `prd-to-prod`

**Files**
- Create: `docs/plans/2026-03-07-v2-consolidation-design.md`

**Steps**
1. Copy the validated design doc from `meeting-to-main/docs/plans/2026-03-07-v2-consolidation-design.md`.
2. Preserve the canonical-location note, but update it to reflect that `prd-to-prod` is now the canonical home.
3. Verify internal links resolve relative to `prd-to-prod/docs/`.

**Validation**
- `test -f docs/plans/2026-03-07-v2-consolidation-design.md`
- `rg -n "Canonical location|TARGET_REPO|template-manifest" docs/plans/2026-03-07-v2-consolidation-design.md`

### Task 0.2: Rewrite `docs/ARCHITECTURE.md` to the target-state model

**Files**
- Modify: `docs/ARCHITECTURE.md`
- Read: `meeting-to-main/docs/ARCHITECTURE.md`

**Steps**
1. Port the target-state architecture narrative from the draft in `meeting-to-main`.
2. Describe both operating modes: greenfield and existing-product.
3. Document the exported scaffold model and the separation between source repo and generated repos.
4. Add the post-consolidation file map and routing rules.
5. Keep current workflow and policy sections only if they still match the target system.

**Validation**
- `rg -n "greenfield|existing product|TARGET_REPO|scaffold|dist/scaffold" docs/ARCHITECTURE.md`

### Task 0.3: Create a drift inventory before moving code

**Files**
- Create: `docs/plans/2026-03-08-v2-consolidation-audit.md` or record inside the PR description

**Steps**
1. Diff `prd-to-prod` against `prd-to-prod-template` for:
   - `.github/`
   - `scripts/`
   - root files (`setup.sh`, `setup-verify.sh`, `vercel.json`, `README`, `AGENTS.md`)
   - `web/`
   - stable docs
2. Diff `meeting-to-main` against the desired future `extraction/`, `trigger/`, and `mocks/` layout.
3. Mark each differing file as one of:
   - port as canonical
   - intentionally drop
   - merge manually
4. Freeze that list before Phase 1 edits begin.

**Required audit buckets**
- **Ingress/auth hardening deltas from `meeting-to-main`:**
  - `trigger/push-to-pipeline.sh`
  - `trigger/smoke-pipeline.sh`
  - `README.md`
  - `docs/HANDOFF.md`
  - `docs/workiq-integration-design.md`
- **Template workflow hardening deltas from `prd-to-prod-template`:**
  - `prd-decomposer.md`
  - `repo-assist.md`
  - `pr-review-agent.md`
  - `pr-review-submit.yml`
  - `_reusable-review-submit.yml`
  - `auto-dispatch.yml`
  - `_reusable-dispatch.yml`
  - `auto-dispatch-requeue.yml`
  - `_reusable-dispatch-requeue.yml`
  - `pipeline-watchdog.yml`
  - `architecture-approve.yml`
  - `ci-failure-issue.yml`
  - `README.md`

**Validation**
- Inventory includes every template-only file currently required by the design.

**Phase Exit Criteria**
- Design doc lives in `prd-to-prod/docs/plans/`
- `docs/ARCHITECTURE.md` describes the target-state system
- File drift inventory exists and names every port/drop decision

**Rollback Boundary**
- Revert documentation-only changes. No runtime path is touched yet.

## Phase 1: Canonical Scaffold Inputs In `prd-to-prod`

### Task 1.1: Port template-only root assets into `prd-to-prod`

**Files**
- Create or modify in `prd-to-prod`:
  - `setup.sh`
  - `setup-verify.sh`
  - `vercel.json`
  - `README.template.md`

**Steps**
1. Copy the current scaffold-facing setup assets from `prd-to-prod-template`.
2. Remove any lingering references that assume a separate template repo identity.
3. Keep the product README and scaffold README separate:
   - `README.md` stays product-facing
   - `README.template.md` becomes scaffold-facing and later exports as `README.md`

**Validation**
- `bash -n setup.sh`
- `bash -n setup-verify.sh`
- `test -f vercel.json`
- `test -f README.template.md`

### Task 1.1a: Preserve ingress bootstrap hardening from `meeting-to-main`

**Files**
- When Phase 3 lands ingress scripts, preserve behavior from:
  - `meeting-to-main/trigger/push-to-pipeline.sh`
  - `meeting-to-main/trigger/smoke-pipeline.sh`

**Required invariants**
1. `push-to-pipeline.sh` and `smoke-pipeline.sh` auto-load `~/.env`
2. bootstrap fails closed on missing App credentials
3. `PIPELINE_BOT_LOGIN` defaults to the real App slug `prd-to-prod-pipeline`
4. smoke validation accepts both `prd-to-prod-pipeline` and `app/prd-to-prod-pipeline`
5. machine-readable outputs remain available for smoke assertions

**Validation**
- `rg -n "source \\\"\\$HOME/.env\\\"|PIPELINE_BOT_LOGIN|app/prd-to-prod-pipeline|PIPELINE_APP_PRIVATE_KEY" trigger/push-to-pipeline.sh trigger/smoke-pipeline.sh`

### Task 1.2: Port the `web/` application into `prd-to-prod`

**Files**
- Create: `web/`

**Steps**
1. Copy `web/` from `prd-to-prod-template`.
2. Remove generated artifacts that should not become canonical source:
   - `node_modules/`
   - `.next/`
   - `playwright-report/`
   - `test-results/`
   - `*.log`
   - `*.tsbuildinfo`
3. Verify `.gitignore` in the root still ignores the web build outputs.
4. Confirm `web` tolerates an empty `showcase/` directory.

**Validation**
- `find web -maxdepth 2 -type d | sort`
- `test ! -d web/node_modules`
- `test ! -d web/.next`

### Task 1.3: Reconcile workflow drift and decide the canonical workflow set

**Files**
- Modify under `.github/workflows/`

**Steps**
1. Review files present only in `prd-to-prod-template`, especially:
   - `_reusable-dispatch.yml`
   - `_reusable-dispatch-requeue.yml`
   - `_reusable-review-submit.yml`
   - `ci-web.yml`
2. For each file, choose one:
   - port into `prd-to-prod`
   - replace with existing canonical logic
   - document as intentionally obsolete and do not export
3. Reconcile content drift in shared files where `prd-to-prod` and `prd-to-prod-template` both have a version.
4. Update the drift inventory with the final decision.

**Hard requirements from current local template hardening**
- Preserve GitHub App safe-output posture in:
  - `prd-decomposer.md`
  - `repo-assist.md`
  - `pr-review-agent.md`
- Preserve review/merge trust-chain hardening in:
  - `pr-review-submit.yml`
  - `_reusable-review-submit.yml`
- Preserve fail-closed autonomous dispatch behavior in:
  - `auto-dispatch.yml`
  - `_reusable-dispatch.yml`
  - `auto-dispatch-requeue.yml`
  - `_reusable-dispatch-requeue.yml`
  - `pipeline-watchdog.yml`
  - `architecture-approve.yml`
  - `ci-failure-issue.yml`

**Specific invariants to retain**
1. No silent `GITHUB_TOKEN` fallback for autonomous dispatch, merge, follow-up, watchdog, architecture approval, or CI-repair routing paths
2. Trusted review-verdict authors include the repo owner plus the configured pipeline App identity
3. Autonomous merge and autonomous follow-up fail closed when App token generation fails
4. `pr-review-agent` activation accepts the configured pipeline bot identity
5. Discussion/comment permissions remain hardened as in the local template patch set
6. Decomposer reconciliation hardening in `prd-decomposer.md` is preserved during port
7. Reusable workflow variants stay semantically aligned with their non-reusable counterparts

**Verification pass**
Run targeted greps after reconciliation:

```bash
rg -n "Generate App token|Require pipeline App token|GITHUB_TOKEN|PIPELINE_BOT_LOGIN|app/\\{0\\}|app/prd-to-prod-pipeline" .github/workflows
```

**Validation**
- Final workflow set is explicitly listed in the PR notes.
- `gh aw compile` still succeeds after any workflow-source changes.

### Task 1.4: Port stable docs and scaffold-facing helper content

**Files**
- Create or modify:
  - `docs/SELF_HEALING_MVP.md` if missing or outdated
  - `docs/why-gh-aw.md` if missing or outdated
  - `docs/decision-ledger/README.md`
  - `docs/prd/sample-prd.md`
  - `showcase/README.md` if missing

**Steps**
1. Ensure every stable doc named in the manifest exists in `prd-to-prod`.
2. Keep internal migration docs out of the exported scaffold.
3. Add `showcase/README.md` if the root showcase directory lacks a stable stub.

**Validation**
- `test -f docs/SELF_HEALING_MVP.md`
- `test -f docs/why-gh-aw.md`
- `test -f docs/decision-ledger/README.md`
- `test -f docs/prd/sample-prd.md`
- `test -f showcase/README.md`

**Phase Exit Criteria**
- `prd-to-prod` contains every canonical scaffold input the design expects
- No template-only asset remains only in `prd-to-prod-template` without an explicit drop decision

**Rollback Boundary**
- Revert the ported asset set as a single PR. Greenfield provisioning still uses the old template path.

## Phase 2: Scaffold Export System

### Task 2.1: Create the scaffold directory and manifest

**Files**
- Create:
  - `scaffold/template-manifest.yml`
  - `scaffold/`

**Steps**
1. Encode the validated allowlist from the design doc into `template-manifest.yml`.
2. Keep `docs/plans/`, `extraction/`, `trigger/`, `PRDtoProd/`, `PRDtoProd.Tests/`, and `drills/` in `forbidden_paths`.
3. Include every workflow-referenced helper script and every stable scaffold doc.
4. Keep `showcase/README.md` as the only scaffold showcase input.

**Validation**
- `python3 - <<'PY'\nimport yaml\nfrom pathlib import Path\nyaml.safe_load(Path('scaffold/template-manifest.yml').read_text())\nPY`

### Task 2.2: Create rendered template sources for mutable scaffold files

**Files**
- Create:
  - `scaffold/templates/autonomy-policy.yml.tmpl`
  - `scaffold/templates/.deploy-profile.tmpl`
  - `scaffold/templates/AGENTS.md.tmpl`

**Steps**
1. Move scaffold defaults out of the product-specific root files and into render templates.
2. Template:
   - app directory
   - sensitive directories
   - deploy profile
   - minimal agent guidance for generated repos
3. Keep product-specific root files in `prd-to-prod` intact unless the consolidation explicitly replaces them.

**Validation**
- Render templates contain placeholder variables and no product-only references.

### Task 2.3: Implement `export-scaffold.sh`

**Files**
- Create: `scaffold/export-scaffold.sh`

**Steps**
1. Parse `template-manifest.yml`.
2. Rebuild `dist/scaffold/` from scratch.
3. Copy `include` paths.
4. Render the three template files with default values.
5. Apply `rename` mappings.
6. Run `gh aw compile` inside `dist/scaffold/` twice.
7. Invoke `leak-test.sh`.
8. Invoke `bootstrap-test.sh`.

**Validation**
- `bash -n scaffold/export-scaffold.sh`
- `bash scaffold/export-scaffold.sh`

### Task 2.4: Implement `leak-test.sh`

**Files**
- Create: `scaffold/leak-test.sh`

**Steps**
1. Walk `dist/scaffold/`.
2. Fail on any forbidden path or forbidden pattern from the manifest.
3. Allow `showcase/README.md` and `docs/prd/sample-prd.md` as explicit exceptions.

**Validation**
- Positive case: `bash scaffold/leak-test.sh`
- Negative case: inject a forbidden path into a temp scaffold copy and confirm non-zero exit

### Task 2.5: Implement `bootstrap-test.sh`

**Files**
- Create: `scaffold/bootstrap-test.sh`

**Steps**
1. Copy `dist/scaffold/` into a temp directory.
2. `git init` in the temp directory.
3. Check for file completeness:
   - compiled lock files
   - workflow helper scripts
   - rendered config files
   - setup tools
4. Validate config consistency:
   - `.deploy-profile` points at an existing profile
   - `autonomy-policy.yml` has no placeholders
5. Delete lock files and rerun `gh aw compile` twice.
6. Fail if regenerated lock files are missing.

**Validation**
- `bash scaffold/bootstrap-test.sh`

### Task 2.6: Compare exported scaffold to the intended template surface

**Files**
- Read:
  - `dist/scaffold/`
  - `prd-to-prod-template/`

**Steps**
1. Generate a file-tree diff between `dist/scaffold/` and the approved target surface.
2. Resolve every unexpected addition or omission before Phase 3 starts.
3. Document intentional differences:
   - no internal `docs/plans/`
   - rendered template files
   - no generated artifacts

**Validation**
- `diff -qr dist/scaffold /Users/skahessay/Documents/Projects/active/prd-to-prod-template` is reviewed and any remaining differences are explicitly justified

**Phase Exit Criteria**
- `dist/scaffold/` can be rebuilt from scratch
- leak test and bootstrap test pass
- exported scaffold contains the approved runtime surface and nothing else

**Rollback Boundary**
- Revert `scaffold/` and `dist/` work without affecting runtime greenfield flow.

## Phase 3: Greenfield Cutover

### Task 3.1: Copy ingress code from `meeting-to-main` into `prd-to-prod`

**Files**
- Create:
  - `extraction/`
  - `trigger/`
  - `mocks/`

**Steps**
1. Copy `meeting-to-main/extraction/`, `meeting-to-main/trigger/`, and `meeting-to-main/mocks/`.
2. Remove product-specific references to `meeting-to-main` from logging, comments, and script output.
3. Keep behavior unchanged for the existing v1 path during the copy.
4. Preserve the locally hardened bootstrap and smoke behavior from `meeting-to-main` rather than re-copying an older version.

**Validation**
- `bash -n extraction/extract-prd.sh`
- `bash -n trigger/push-to-pipeline.sh`
- `bash -n trigger/smoke-pipeline.sh`

### Task 3.2: Retarget `push-to-pipeline.sh` to the exported scaffold

**Files**
- Modify: `trigger/push-to-pipeline.sh`

**Steps**
1. Replace the default provisioning source from `prd-to-prod-template` to `dist/scaffold/`.
2. Keep a temporary fallback flag for the old template source during the cutover PR only.
3. Ensure the script can:
   - export scaffold
   - create repo from local scaffold
   - provision labels, secrets, variables, and workflow permissions
   - compile workflows in the generated repo
   - create the seed `[Pipeline]` issue
4. Remove the fallback in a later PR after greenfield smoke passes.

**Validation**
- `bash -n trigger/push-to-pipeline.sh`
- Local dry run mode or smoke mode completes without referencing `prd-to-prod-template`

### Task 3.3: Restore greenfield entrypoint parity in `prd-to-prod`

**Files**
- Modify:
  - `extraction/extract-prd.sh`
  - any shared helper files added during migration

**Steps**
1. Preserve the existing v1 transcript -> PRD -> repo flow.
2. Update script paths to the new repo layout.
3. Ensure mock-mode and `WORKIQ_LIVE=true` still work.

**Validation**
- Mock run produces a validated PRD
- Smoke path can reach repo provisioning without template-repo dependency

### Task 3.4: Add greenfield smoke automation

**Files**
- Create or modify:
  - `trigger/smoke-pipeline.sh`
  - `trigger/smoke-prd.md`
  - optional scaffold smoke helper

**Steps**
1. Port the smoke scripts from `meeting-to-main` if not already present.
2. Ensure the smoke path exercises the exported scaffold rather than the old template repo.
3. Record the exact command for operators.
4. Keep the author/verdict checks compatible with both `prd-to-prod-pipeline` and `app/prd-to-prod-pipeline`.

**Validation**
- Smoke run creates a disposable repo and reaches the first autonomous steps

**Phase Exit Criteria**
- `prd-to-prod` can perform the current greenfield flow using `dist/scaffold/`
- No required runtime step still depends on `prd-to-prod-template`

**Rollback Boundary**
- Revert ingress migration and scaffold-targeting changes together. Old template-based path remains available until this phase is accepted.

## Phase 4: Existing-Product V2 Routing

### Task 4.1: Add the unified entrypoint

**Files**
- Create: `extraction/run.sh`

**Steps**
1. Implement `--mode auto|greenfield|existing`.
2. Enforce `TARGET_REPO` for existing mode.
3. Skip classification when `TARGET_REPO` is set unless the user forces greenfield mode.

**Validation**
- `bash -n extraction/run.sh`
- Mode matrix matches the design doc

### Task 4.2: Add transcript classification

**Files**
- Create: `extraction/classify.sh`

**Steps**
1. Call the LLM with a short routing prompt.
2. Return exactly `greenfield` or `existing`.
3. Fail if the output is anything else.

**Validation**
- Mock transcript fixture for greenfield returns `greenfield`
- Existing-product fixture returns `existing`

### Task 4.3: Add issue extraction for existing-product meetings

**Files**
- Create:
  - `extraction/extract-issues.sh`
  - `extraction/prompt-issues.md`

**Steps**
1. Fetch transcript using the same WorkIQ input layer as v1.
2. Ask the LLM for structured issue output.
3. Validate:
   - item type
   - title
   - description
   - acceptance criteria
   - dependencies section
   - PRD traceability section
4. Keep the output shape aligned with `prd-decomposer` expectations.

**Validation**
- Mock transcript returns valid JSON
- Validator rejects malformed or incomplete items

### Task 4.4: Add `push-to-existing.sh`

**Files**
- Create: `trigger/push-to-existing.sh`

**Steps**
1. Accept `TARGET_REPO`.
2. Create `[Pipeline]` issues with one type label each.
3. Inject idempotency markers:
   - transcript hash
   - item index
4. Check for existing open issues with the same hash before creating duplicates.
5. Keep issue bodies compatible with downstream `repo-assist` dependency parsing.

**Validation**
- `bash -n trigger/push-to-existing.sh`
- Duplicate run against the same transcript does not create duplicate issues

### Task 4.5: Add v2 smoke coverage

**Files**
- Create tests or fixtures under:
  - `extraction/test-fixtures/`
  - optional shell test harness

**Steps**
1. Add at least one existing-product transcript fixture.
2. Validate issue generation order and issue-body shape.
3. Exercise `TARGET_REPO` fail-fast behavior.

**Validation**
- Existing-product smoke path produces correctly shaped issues in a test repo or dry-run output

**Phase Exit Criteria**
- Existing-product mode works without touching downstream workflows
- `TARGET_REPO` is required and enforced
- Idempotency prevents duplicate issue bursts

**Rollback Boundary**
- Revert `run.sh`, `classify.sh`, `extract-issues.sh`, `prompt-issues.md`, and `push-to-existing.sh` together. Greenfield path remains intact.

## Phase 5: CI, Publication, And Hardening

### Task 5.1: Add scaffold CI checks

**Files**
- Modify or create workflow(s) under `.github/workflows/`

**Steps**
1. Run `scaffold/export-scaffold.sh` on relevant changes.
2. Run `leak-test.sh` on every PR touching scaffold-relevant files.
3. Run `bootstrap-test.sh` on scaffold-relevant files.
4. Fail the PR if the scaffold is not reproducible.

**Validation**
- CI workflow passes on a clean branch

### Task 5.2: Add scaffold publication

**Files**
- Modify or create publication workflow and any supporting script

**Steps**
1. Choose publication target:
   - export branch in `prd-to-prod`
   - separate published scaffold repo
2. Publish only from green `main`.
3. Keep `dist/scaffold/` out of `main`.

**Validation**
- Publication target receives the rebuilt scaffold from CI or a controlled release command

### Task 5.3: Remove temporary greenfield fallbacks

**Files**
- Modify:
  - `trigger/push-to-pipeline.sh`
  - any temporary compatibility helpers

**Steps**
1. Remove the old template-repo fallback once scaffold cutover is stable.
2. Remove any comments or env vars that still position `prd-to-prod-template` as required.

**Validation**
- `rg -n "prd-to-prod-template|PIPELINE_TEMPLATE_SOURCE_DIR" trigger extraction README.md docs`

### Task 5.4: Update public and operator docs

**Files**
- Modify:
  - `README.md`
  - `README.template.md`
  - `docs/ARCHITECTURE.md`
  - `docs/HANDOFF.md`
  - `docs/workiq-integration-design.md`
  - any operator/runbook docs that reference the old repo split

**Steps**
1. Update setup instructions to point at scaffold export rather than the old template repo.
2. Update architecture references to the consolidated model.
3. Keep product-facing and scaffold-facing docs distinct.
4. Port the current hardening notes from `meeting-to-main` and the locally updated template README so the docs match the fail-closed App-auth model.

**Validation**
- `rg -n "meeting-to-main|prd-to-prod-template|Use this template" README.md README.template.md docs`
- `rg -n "PIPELINE_BOT_LOGIN|App token|fail closed|smoke-pipeline" README.md README.template.md docs`

**Phase Exit Criteria**
- Scaffold export is enforced by CI
- Scaffold publication exists
- No live path still requires the old template repo

**Rollback Boundary**
- Revert CI/publication changes independently of runtime routing if needed.

## Phase 6: Decommission And Final Cleanup

### Task 6.1: Archive `meeting-to-main`

**Preconditions**
- Phase 3 and Phase 4 exit criteria are met
- Canonical design and architecture docs live in `prd-to-prod`

**Steps**
1. Update `meeting-to-main` README to point to the new home.
2. Archive the repo.
3. Record the archive date in `prd-to-prod/docs/plans/2026-03-07-v2-consolidation-design.md`.

### Task 6.2: Archive `prd-to-prod-template`

**Preconditions**
- Scaffold export and publication are stable
- Greenfield smoke passes from exported scaffold

**Steps**
1. Update `prd-to-prod-template` README to point to the exported scaffold source.
2. Archive the repo.
3. Record the archive date in the design doc and README.

### Task 6.3: Final cleanup

**Steps**
1. Remove dead references from docs, scripts, and comments.
2. Delete any temporary migration helpers that only existed during cutover.
3. Re-run the full validation matrix.

**Validation Matrix**
- `gh aw compile`
- `bash scaffold/export-scaffold.sh`
- `bash scaffold/leak-test.sh`
- `bash scaffold/bootstrap-test.sh`
- greenfield smoke run
- existing-product smoke run

**Phase Exit Criteria**
- `prd-to-prod` is the only edited source repo
- Both retired repos are archived
- Greenfield and existing-product flows both pass from the consolidated repo

## Final Success Criteria

- [ ] `prd-to-prod/docs/plans/2026-03-07-v2-consolidation-design.md` is canonical
- [ ] `docs/ARCHITECTURE.md` describes the consolidated model
- [ ] `prd-to-prod` holds all scaffold inputs directly
- [ ] `scaffold/export-scaffold.sh` materializes a valid standalone scaffold
- [ ] Greenfield provisioning uses exported scaffold rather than `prd-to-prod-template`
- [ ] Existing-product mode creates correctly shaped `[Pipeline]` issues in `TARGET_REPO`
- [ ] CI enforces scaffold reproducibility
- [ ] `meeting-to-main` is archived
- [ ] `prd-to-prod-template` is archived
