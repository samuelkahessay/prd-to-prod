# Self-Serve Build Flow — Gap Analysis & Test Plan

**Date**: 2026-03-19
**Status**: Draft (v2 — incorporates Codex review findings)
**Context**: PR #511 shipped the public beta bootstrap flow. The demo CTA is live on the landing page. This plan covers what remains to make `/build` work as a real self-serve route for paying users.

---

## Architecture Summary

The core code path exists end-to-end. What remains is launch gating, hardening, and one pipeline activation gap.

```text
Landing page ("Watch it build")
  → /build (chat with LLM, refine PRD)
  → /finalize (bind session to authenticated user, lock PRD)
  → payment + BYOK gate
  → OAuth redirect to GitHub (if not authenticated)
  → /provision (create private repo from template, install App, bootstrap)
  → /start-build (create root PRD issue, dispatch decomposer)
  → Webhook-driven event tracking (issues, PRs, workflow runs, deployments)
  → Factory visualization (real-time via SSE)
  → Terminal state:
      - complete        = validated deployment exists
      - handoff_ready   = pipeline finished successfully with no deployment
```

Real users use `provisioner.launchPipeline()` which dispatches `prd-decomposer.lock.yml` on the target repo. They do not use `buildRunner.dispatchBuild()`; that path remains demo-only.

Current operating limit: webhook delivery tracking, session state, and refs live in console-local SQLite on Fly. Beta must stay single-instance until storage/routing is centralized.

---

## Tier 0: Launch Blockers

These must be fixed before charging or allowing external self-serve traffic.

### 0.1 Session auth and ownership hardening (HARD BLOCKER)

**Severity**: Critical — security boundary is not strong enough for external users
**Symptom**: Real build sessions can exist before authenticated ownership is established, session IDs are URL-addressable, and non-demo session read/write endpoints are not consistently owner-scoped. OAuth grant expiry also has no clean recovery path.

**Required work**:
- No anonymous server-backed real build sessions. Anonymous flow stays demo-only.
- Require owner checks on non-demo `GET /pub/build-session/:id`, `/message`, `/finalize`, `/provision`, and `/start-build`.
- Preserve resume-after-OAuth, but only for the same authenticated owner.
- Add a clear re-auth/resume path for expired browser sessions or expired OAuth grants.
- Keep demo auth isolated from real-user auth.

### 0.2 BYOK for Copilot and deployment credentials (HARD BLOCKER)

**Severity**: Critical — current real flow injects platform credentials into customer repos
**Symptom**: Provisioning currently relies on platform `COPILOT_GITHUB_TOKEN`. That is acceptable for demo/internal runs, not for paid self-serve. Deployment credentials are also not user-scoped.

**Required work**:
- Add a required "Configure your pipeline" gate before launch.
- Require customer-provided `COPILOT_GITHUB_TOKEN` for real builds.
- Accept optional deployment credentials: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Encrypt user-supplied credentials at rest on the console until bootstrap writes them to the target repo.
- Do not silently fall back to platform Copilot credentials for customer traffic.
- If deployment credentials are omitted, the run must still be able to finish in `handoff_ready`.

### 0.3 Payment gate before provisioning (LAUNCH GATE)

**Severity**: Critical — the $1 offer is advertised but not enforced
**Symptom**: The current flow can create repos and spend agent/runtime resources without payment.

**Required work**:
- Add a payment checkpoint before `provision`.
- Use the simplest enforceable path: Stripe Checkout session before repo creation.
- Record paid state on the build session and block provisioning until paid.
- Keep any unpaid session resumable so the user can complete payment later.
- Allow staff-only sandbox bypass outside the public path.

### 0.4 Private repos by default (HARD BLOCKER)

**Severity**: Critical — customer repos and PRDs must not default to public
**Symptom**: `createRepoFromTemplate()` currently creates repos with `private: false`.

**Fix**:
- Default all provisioned repos to private.
- Treat public visibility as an explicit future option, not the default.
- Verify the UI, audit trail, and test plan all assume private-by-default behavior.

---

## Tier 1: Environment Configuration

Configuration is split across three surfaces. Do not treat this as one flat env-var list.

### 1.1 Console / Fly

These are secrets/vars on the `prd-to-prod` production console.

#### Required Secrets

| Secret | Purpose | Source |
|--------|---------|--------|
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth token exchange | GitHub App → OAuth settings |
| `LLM_API_KEY` or `OPENROUTER_API_KEY` | Real PRD refinement in `/build` | LLM provider dashboard |
| `PIPELINE_APP_PRIVATE_KEY` | App JWT signing for installation tokens | GitHub App settings → Generate private key |
| `GITHUB_APP_WEBHOOK_SECRET` | Webhook signature verification (HMAC-SHA256) | GitHub App settings → Webhook secret |
| `ENCRYPTION_KEY` | Encrypt OAuth grants and BYOK credentials at rest (hex-encoded 32 bytes) | Generate once, keep stable |
| `STRIPE_SECRET_KEY` | Create/verify checkout sessions before provisioning | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Mark sessions paid from Stripe webhooks | Stripe dashboard |

#### Required Variables

| Variable | Purpose | Value |
|----------|---------|-------|
| `GITHUB_OAUTH_CLIENT_ID` | User authentication via GitHub OAuth | GitHub App → OAuth settings |
| `PIPELINE_APP_ID` | App JWT issuer ID | GitHub App settings → App ID |
| `FRONTEND_URL` | OAuth redirect base URL | `https://prd-to-prod.vercel.app` |
| `PUBLIC_BETA_TEMPLATE_OWNER` | Template repo owner | `samuelkahessay` |
| `PUBLIC_BETA_TEMPLATE_REPO` | Template repo name | `prd-to-prod-template` |
| `STRIPE_PRICE_ID` | $1 self-serve SKU used by Checkout | Stripe dashboard |

#### Optional Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PUBLIC_BETA_MAX_ACTIVE_BUILDS` | Concurrent build capacity | `2` |
| `PUBLIC_BETA_PIPELINE_BOT_LOGIN` | Bot login injected into target repos | `prd-to-prod-pipeline` |
| `PUBLIC_BETA_VERCEL_PROJECT_PRODUCTION_URL_TEMPLATE` | Deterministic production URL template (e.g. `https://{repo}.example.com`) | (none) |
| `PUBLIC_BETA_VERCEL_DOMAIN_SUFFIX` | Simpler production URL pattern fallback | (none) |
| `LLM_MODEL` | OpenRouter model ID | `z-ai/glm-5` |

#### Optional / Internal-Only Secrets

| Secret | Purpose | Default |
|--------|---------|---------|
| `PUBLIC_BETA_COPILOT_GITHUB_TOKEN` | Staff-only fallback for demo/internal sandbox runs; not allowed for customer traffic | (none) |
| `GH_AW_GITHUB_TOKEN` | Demo-only `buildRunner` path | (none) |

### 1.2 Frontend / Vercel

These are vars on the Vercel-hosted Next.js frontend.

#### Required Variables

| Variable | Purpose | Value |
|----------|---------|-------|
| `API_URL` | Rewrites `/api/*` and `/pub/*` from Vercel to the Fly console | `https://prd-to-prod.fly.dev` |

#### Optional Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Support contact shown on stalled/failed runs | current fallback email |

### 1.3 Target Repo Bootstrap

These are written into each provisioned target repo during bootstrap. They are not part of Fly or Vercel app config.

#### Required Variables

| Variable | Purpose | Source |
|----------|---------|--------|
| `PIPELINE_APP_ID` | App auth in target-repo workflows | copied from console config |
| `PIPELINE_BOT_LOGIN` | Bot identity used by pipeline workflows | copied from console config |

#### Required Secrets

| Secret | Purpose | Source |
|--------|---------|--------|
| `PIPELINE_APP_PRIVATE_KEY` | App auth in target-repo workflows | copied from console config |
| `COPILOT_GITHUB_TOKEN` | Repo agent execution token | customer BYOK credential |

#### Conditional Secrets

| Secret | Purpose | Source |
|--------|---------|--------|
| `VERCEL_TOKEN` | Vercel deployment | customer BYOK credential |
| `VERCEL_ORG_ID` | Vercel deployment | customer BYOK credential |
| `VERCEL_PROJECT_ID` | Vercel deployment | customer BYOK credential |

#### Conditional Variables

| Variable | Purpose | Source |
|----------|---------|--------|
| `VERCEL_PROJECT_PRODUCTION_URL` | Display + validated deploy URL when deployment is configured | derived or user-provided |

Bootstrap must also create labels, Actions permissions, auto-merge, branch protection, and `memory/repo-assist`.

### Verification Checklist

- [ ] GitHub App webhook URL set to `https://prd-to-prod.fly.dev/webhooks/github-app`
- [ ] GitHub OAuth callback URL set to `https://prd-to-prod.vercel.app/pub/auth/github/callback`
- [ ] OAuth scopes include `repo` and `read:user`
- [ ] GitHub App has permissions: Contents (rw), Issues (rw), Pull requests (rw), Actions (rw), Metadata (r)
- [ ] GitHub App subscribes to events: installation, installation_repositories, issues, pull_request, issue_comment, workflow_run, push
- [ ] Stripe Checkout and webhook are configured for the public path
- [ ] `ENCRYPTION_KEY` is persistent across deploys
- [ ] Frontend `API_URL` points at the production Fly console
- [ ] Fly production stays at one machine while webhook/session state is stored in local SQLite
- [ ] `PIPELINE_APP_ID` is treated as a variable; `PIPELINE_APP_PRIVATE_KEY` remains a secret
- [ ] Real builds create private repos by default
- [ ] `DEMO_MODE` is NOT set in production
- [ ] Demo-only fallback tokens are not used for customer traffic

---

## Tier 2: Known Bugs

These require code or investigation work after Tier 0 blockers are addressed. Ordered by severity.

### 2.1 Decomposer activation skipped on fresh repos (PIPELINE-KILLER)

**Severity**: Critical — blocks the entire pipeline
**Symptom**: `/decompose` command is detected (pre_activation succeeds), but the `activation` job is skipped. Agent never runs. No child issues are created. repo-assist has nothing to implement.

**Investigation**:
- Check gh-aw activation logs on a fresh provisioned repo.
- Compare activation step conditions against the permissions/configuration the provisioner sets.
- May need: additional App permissions, `gh aw compile` during provisioning, or `memory/repo-assist` branch seeding.
- References: open task in memory, also noted in e2e test 2026-03-16.

### 2.2 Deployment completion inconsistency

**Severity**: High — successful runs can get stuck behind deployment-specific completion logic
**Symptom**: The current narrative assumes deployment success is the only successful terminal condition. That conflicts with the real launch plan, where some paid users will supply Copilot credentials but not Vercel credentials.

**Fix**:
- Add explicit non-deployment terminal state: `handoff_ready`.
- Reserve `complete` for runs with validated deployment and a stable `deploy_url`.
- Update webhook handling, build-status UI, and success copy to treat both states as successful.
- Ensure no-deploy runs do not wait forever on `Validate Deployment`.

### 2.3 CI noise on fresh repos

**Severity**: Medium — confusing and obscures real failures
**Symptom**: Every push to main triggers deploy-router → deploy-vercel, which fails without Vercel secrets. That creates CI failure issues and CI Doctor diagnostics on repos that are otherwise healthy.

**Fix**:
- Gate deploy-vercel on secret existence in the template repo workflow.
- If Vercel credentials are absent, skip deploy cleanly and allow the run to finish in `handoff_ready`.

### 2.4 Stale lock files in provisioned repos

**Severity**: Medium — causes agent failures
**Symptom**: Provisioned repos get snapshot lock files from the template. If agent `.md` sources update after the template was last compiled, lock files go stale.

**Fix options**:
- Add `gh aw compile` step to provisioner after bootstrap.
- Add CI check to template repo that verifies lock files match `.md` sources.
- Automate template recompilation on a schedule.

### 2.5 Idempotency and race conditions around provision, launch, and webhook processing

**Severity**: High — retries and concurrent events can duplicate work or regress state
**Symptom**: Some paths already have partial idempotency, but not enough for a public flow. `createPrdIssue()` reuses an existing stored root issue ref, but repo creation, workflow dispatch, bootstrap resume, and terminal state handling still need race-proofing.

**Risks**:
- Double `provision` before `github_repo` is persisted can trigger duplicate repo-create attempts.
- Double `start-build` can dispatch decomposer twice.
- App-install webhook and manual retry can both resume bootstrap.
- Duplicate or out-of-order webhook events can append misleading activity or regress status after success.

**Required work**:
- Make repo creation, bootstrap resume, and launch dispatch idempotent by session.
- Add state-transition guards so terminal states are monotonic.
- Keep webhook delivery dedupe, but test duplicate and out-of-order deliveries explicitly.
- Treat late events as annotations, not as permission to move a session backwards.

### 2.6 Single-instance webhook limitation

**Severity**: Medium — operational limitation for beta, scaling blocker later
**Symptom**: Session state, refs, and webhook dedupe live in local SQLite on the Fly console. Multiple instances would split state and make webhook handling nondeterministic.

**Operating rule / fix**:
- Run beta on a single Fly instance.
- Before scaling out, move session/event/webhook state off local disk or guarantee sticky routing for all webhook traffic.

---

## Tier 3: UX Gaps

Separate follow-up work. Not launch blockers once Tier 0-2 are resolved.

### 3.1 Factory celebration timing

Factory shows "CELEBRATING" when provisioning finishes. It should celebrate only on successful terminal states: `complete` or `handoff_ready`.

### 3.2 Skip finalize for already-ready sessions

When a session is already finalized and the user triggers the build flow again, `/finalize` returns 400 before `/provision` proceeds. Frontend should check session status and skip finalize if already ready.

### 3.3 Repo link on build status page

Repo name shows as plain text. It should be a clickable link to `https://github.com/{owner}/{repo}`.

---

## End-to-End Test Plan

### Prerequisites

- Tier 0 blockers shipped
- Console / Fly config set
- Frontend / Vercel config set
- GitHub App webhook and OAuth URLs verified
- Stripe test mode configured
- Template repo (`prd-to-prod-template`) is current
- Fly console pinned to one machine
- Internal sandbox GitHub user available
- BYOK Copilot token available for sandbox
- Optional Vercel sandbox project available for deployment-enabled test

### Test Sequence

**Phase 1: Smoke test (demo mode)**
1. Visit `https://prd-to-prod.vercel.app`
2. Click "Watch it build"
3. Verify chat loads, mock LLM responds
4. Verify factory animation plays through provisioning → build → complete
5. Verify conversion nudge appears at completion: "That was a simulation. Ready for the real thing?"
6. Verify no real repo is created and no real credentials are required

**Phase 2: Security gates + payment/BYOK checks**
1. Visit `/build` logged out
2. Verify real-session endpoints are not readable/writable without authenticated ownership
3. Authenticate with GitHub and verify the same session resumes for the same user only
4. Finalize a PRD and verify payment is required before provisioning
5. Complete Stripe test checkout and verify session is marked paid
6. Attempt to continue without `COPILOT_GITHUB_TOKEN` and verify launch is blocked with a clear prompt
7. Add Copilot BYOK only and verify the no-deploy path remains valid

**Phase 3: Sandbox real flow — no deployment**
1. Visit `/build` as the internal sandbox user
2. Type a project idea and get the PRD to `ready`
3. Finalize, pay, and provide Copilot BYOK
4. Verify provisioning creates a private repo
5. If App install is required: follow install link and resume
6. Verify bootstrap completes: labels, variables, secrets, branch protection, repo-memory
7. Check the target repo on GitHub:
   - repo is private
   - `PIPELINE_APP_ID` exists as a variable
   - `PIPELINE_APP_PRIVATE_KEY` and `COPILOT_GITHUB_TOKEN` exist as secrets
8. Start the build
9. Verify decomposer activation actually runs
10. Watch for child issues and repo-assist execution
11. Let the run finish without Vercel credentials
12. Verify session ends in `handoff_ready`
13. Verify repo link appears and no deploy URL is required

**Phase 4: Sandbox real flow — with deployment**
1. Repeat the flow with `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`
2. Verify target repo receives Vercel secrets/variables
3. Watch PR activity and deployment workflow
4. Verify `Validate Deployment` succeeds
5. Verify session transitions to `complete`
6. Verify "Open deployed app" link appears and resolves correctly

**Phase 5: Fresh-user full E2E rehearsal**
1. Use a clean browser profile and a second GitHub test account
2. Start from the landing page CTA
3. Run the full public path: auth → PRD finalize → payment → BYOK → provision → build → success
4. Verify resume behavior works across redirects and page refreshes
5. Verify support/error states are understandable without operator intervention

### Failure Scenarios to Test

- [ ] Unauthenticated user cannot read or write an existing real build session
- [ ] Authenticated user cannot take over another user's `session` URL
- [ ] Payment not completed → provisioning blocked, no repo created
- [ ] Missing `COPILOT_GITHUB_TOKEN` → launch blocked with clear prompt
- [ ] Invalid `COPILOT_GITHUB_TOKEN` → clean bootstrap failure with recovery path
- [ ] Repo is created private by default
- [ ] OAuth denied by user → graceful error, session preserved
- [ ] Browser auth session expired or OAuth grant expired → clear re-auth + resume path
- [ ] App not installed → install prompt, retry works
- [ ] Provisioning retry after failure → idempotent, reuses existing repo
- [ ] Double-click `provision` → no duplicate repo creation
- [ ] Double-click `start-build` → one root issue, one decomposer dispatch
- [ ] Duplicate webhook delivery → deduped, no duplicate events
- [ ] Out-of-order webhook deliveries → session does not regress from `handoff_ready` or `complete`
- [ ] Capacity limit reached → `awaiting_capacity` state, retry button
- [ ] Pipeline stalls → `stalled` state, retry/help actions available
- [ ] No-deploy run reaches `handoff_ready`
- [ ] Deploy-enabled run reaches `complete` with deploy URL
- [ ] Console restart on the single Fly instance preserves session and webhook state

---

## Execution Order

1. **Ship Tier 0 security/commercial blockers** — session auth, BYOK, payment gate, private repos, and non-deploy terminal state.
2. **Set config** (Tier 1) — Console/Fly, Frontend/Vercel, and target-repo bootstrap inputs.
3. **Run sandbox tests first** — Phase 1 through Phase 4 with internal accounts and Stripe/Vercel test credentials.
4. **Run full E2E rehearsal** — clean-account pass through the public flow from landing page to success.
5. **Fix Tier 2 bugs** surfaced during sandbox/full E2E, especially decomposer activation and idempotency gaps.
6. **Address Tier 3 UX gaps** as follow-up work after the real path is proven.

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Real users use `provisioner.launchPipeline()`, not `buildRunner` | Target repo's own pipeline handles everything via decompose → child issues → repo-assist |
| Demo mode stays as-is (mock services, no auth cost, no repo creation) | Zero-friction entry point still matters, but it is not the production path |
| External self-serve requires authenticated session ownership | Real build sessions cannot be anonymous or transferable by URL |
| External self-serve requires BYOK Copilot token | Customer repos must not consume platform Copilot quota |
| External self-serve requires payment before provisioning | Repo creation and agent/runtime spend are paid resources |
| Provisioned repos default to private | Customer PRDs, code, and workflow history should not be public by default |
| `handoff_ready` is a valid successful terminal state | Some valid runs will intentionally skip deployment |
| `complete` is reserved for validated deployment | Deployment success should remain a stronger, explicit terminal state |
| Beta stays single-instance on Fly | Local SQLite + webhook handling are not multi-instance safe yet |
