# Aurrin Ventures Case Study — Design Spec

**Date:** 2026-03-21
**Audience:** Abdul (Aurrin Ventures co-founder) and his team. Direct-link only — not in main nav.
**Purpose:** Two pages. Page 1 pitches the partnership value. Page 2 is the refined technical architecture and ADRs for the Aurrin platform build.

Both pages are `noindex` and not discoverable via site navigation.

---

# Page 1: Partnership Overview

**Route:** `/case-studies/aurrin-ventures`

## 1.1 Metadata

```ts
export const metadata: Metadata = {
  title: "Aurrin Ventures x prd-to-prod",
  description:
    "How Aurrin Ventures is using autonomous delivery infrastructure to build a full-stack event and validation platform.",
  robots: { index: false, follow: false },
};
```

## 1.2 Page Structure

Article-style layout matching `/vision` — StickyNav header, `680px` max-width prose, cream theme, CSS Modules.

### Header

- StickyNav (imported from `@/components/landing/sticky-nav`) — serves as the home link via the logo, matching `/vision` exactly. No separate back link.
- Label: `Case Study` — small uppercase monospace text above the title (new `.label` class: `font-size: 0.8rem`, `text-transform: uppercase`, `letter-spacing: 0.08em`, `color: var(--ink-muted)`, `font-family: var(--font-mono)`, `margin-bottom: 0.75rem`)
- Title: **"Aurrin Ventures x prd-to-prod"** — reuses `.title` from vision
- Lede: "A Calgary startup accelerator evolving from a static site into a full-stack event and validation platform — built and maintained by an autonomous agent pipeline." — reuses `.lede` from vision

### Section: The Challenge

What Aurrin needs, drawn from the PRD:
- Currently: Next.js marketing site, data in JSON files, content changes require code edits and deploys
- Goal: Full-stack platform — event management, founder applications, judge scoring, audience validation, mentor matching, payments, reporting
- Scope summary: 12 core modules, 6 user roles, 15+ database entities, 3 delivery phases
- This is not a landing page tweak. It's a real product with auth, real-time, Stripe, PDF generation, and role-based access.

Tone: Honest about the scope. This is substantial.

### Section: Why Agent-First Development

The paradigm shift framing. Not "prd-to-prod vs a dev shop" — it's "agent-first development vs traditional development."

Key points:
- Frontier tools now exist for autonomous software delivery: GitHub Agentic Workflows, Copilot agents, Claude, Codex
- These aren't code generators. They're agents that operate inside governed pipelines — decomposing specs, implementing in isolation, reviewing independently, deploying, and recovering from failures
- Traditional dev means: hire a team, manage sprints, coordinate reviews, fix CI manually, lose context when the contractor leaves
- Agent-first means: describe what you want as a GitHub issue, and the pipeline handles implementation, review, merge, deploy, and maintenance
- This is the same shift that happened with cloud infrastructure: from "hire a sysadmin" to "describe what you need and the platform provisions it"

### Section: What Aurrin Gets

Two concrete deliverables:

**A rough MVP.** Not a polished product — an honest first build of the platform. Auth, database, admin dashboard, core modules. The starting point.

**The autonomous delivery infrastructure.** This is the real value. The repository comes with gh-aw workflows baked in:

- **Auto-dispatch:** File a GitHub issue describing a feature or bug. The pipeline picks it up, assigns an agent, and begins implementation.
- **Independent review:** A separate agent reviews every PR. The builder and reviewer are never the same identity.
- **Self-healing CI:** When CI breaks, the pipeline detects the failure, creates a fix issue, assigns an agent, and resolves it — often before anyone notices.
- **Continuous documentation:** Agents update docs as they change code. Documentation doesn't drift.
- **Complete audit trail:** Every decision — who approved what, why, what evidence was presented — is traceable in the repo history.
- **Deploy on merge:** Approved PRs merge and deploy automatically. No manual deploy steps.

The key message: **Aurrin's team doesn't need to call a developer to make changes.** They describe what they want in a GitHub issue. The pipeline ships it. This works on day one and continues working indefinitely.

### Section: The Infrastructure in Detail

Brief technical walkthrough of what lives in the repo. Not exhaustive — enough for Abdul to understand the machinery:

- `auto-dispatch.yml` — routes labeled issues to the right agent
- `repo-assist` — the implementation agent that writes code from issue descriptions
- `pr-review-agent` — independent code review on every PR
- `ci-failure-issue.yml` — detects CI failures and creates fix issues automatically
- Autonomy policy — a machine-readable file defining what agents can and cannot do
- Identity separation — the agent that writes code never approves its own work

Link to `/vision` for the full thesis on harness engineering.

### Section: Where This Goes

Aurrin is an early adopter of governed autonomous delivery. As prd-to-prod evolves:

- The pipeline learns from its own history — which patterns break, which decompositions work best
- Policy becomes configurable — Aurrin can tighten or loosen governance as the platform matures
- Multi-service orchestration — as Aurrin grows beyond a single repo, the pipeline coordinates across services
- The ecosystem grows — better agents, specialized reviewers, marketplace templates

Link to the optimal vision document on GitHub: `https://github.com/samuelkahessay/prd-to-prod/blob/main/docs/optimal-vision.md`

### Closing

Short, confident close. No CTA — just a clean ending statement. Something like: "Aurrin Ventures gets a platform and a pipeline. The platform is the starting point. The pipeline is what makes it self-sustaining."

Inline link to the architecture page: "Read the full technical architecture" pointing to `/case-studies/aurrin-ventures/architecture`.

---

# Page 2: Technical Architecture & ADRs

**Route:** `/case-studies/aurrin-ventures/architecture`

## 2.1 Metadata

```ts
export const metadata: Metadata = {
  title: "Aurrin Platform — Technical Architecture",
  description:
    "Technical architecture, data model, and architecture decision records for the Aurrin Ventures event and validation platform.",
  robots: { index: false, follow: false },
};
```

## 2.2 Purpose

This page takes Aurrin's raw PRD and refines it into a proper technical architecture document with ADRs. It's the "here's what we're actually going to build and why these choices" page — the engineering counterpart to the partnership narrative on page 1.

## 2.3 Page Structure

Same article-style layout as page 1. StickyNav, `680px` max-width, cream theme.

### Header

- Label: `Technical Architecture`
- Title: **"Aurrin Ventures Platform"**
- Lede: "The refined technical plan for Aurrin's event and validation platform. Architecture decisions, data model, and phased delivery."
- Navigation link back to the partnership page: "Read the partnership overview" pointing to `/case-studies/aurrin-ventures`

### Section: Architecture Overview

High-level system description:
- Next.js web tier with thin route handlers and domain services behind it
- PostgreSQL database via Supabase (replaces JSON file storage)
- Supabase Auth for identity; database-backed role assignments and RLS for authorization
- Durable async jobs for webhooks, notifications, reports, social assets, mentor matching, and exports
- Object storage for pitch decks, generated reports, and social assets with signed URLs
- Stripe for payments/subscriptions, backed by a shared commerce data model
- Supabase Realtime for live UX, but Postgres remains the system of record
- Vercel for the web tier, with worker runtime allowed to scale separately
- Structured observability, audit trail, and backup/restore discipline as explicit architecture

### Section: System Boundaries

The page should make the modular boundaries explicit so the architecture does not collapse into "one Next.js app":

- Identity & Access
- Event Operations
- Judging & Rubrics
- Audience Validation
- Founder Outcomes
- Commerce & Entitlements
- Notifications & Media
- Ops & Compliance

### Section: Data Model

The core entities and their relationships. Presented as a clear list/table, not an ER diagram (keeping it prose-friendly):

- Users (identity) / RoleAssignments (authorization + scoping)
- Events / FounderPitches (event-specific founder participation record)
- Rubrics / RubricVersions / normalized score rows
- FounderApplications
- AudienceSessions / AudienceResponses
- Mentors / MentorMatches
- DigitalProducts / Subscriptions / Transactions / Entitlements
- Files (pitch decks, PDFs, assets)
- OutboxJobs (durable async workflows)
- AuditLogs
- Sponsors

### Section: Architecture Decision Records

Each ADR follows a consistent format: **Context**, **Decision**, **Rationale**, **Trade-offs**.

ADRs to include (derived from analyzing the PRD against the current stack and realistic constraints):

**ADR-001: Supabase over raw PostgreSQL**
- Context: PRD says "managed database such as PostgreSQL via Supabase or similar"
- Decision: Supabase
- Rationale: Includes auth, realtime, storage, and row-level security out of the box. Reduces the number of services to integrate. Aurrin's team (non-technical operators) benefits from the Supabase dashboard for direct data inspection.
- Trade-offs: Vendor coupling. Supabase's auth and realtime are good but not infinitely flexible.

**ADR-002: Supabase Auth for identity, database-backed RBAC for authorization**
- Context: PRD requires 6 roles with route-level/data-level access and some users may hold multiple roles concurrently
- Decision: Use Supabase Auth for identity, but store role assignments and scopes in relational tables. JWT claims are not the source of truth for authorization.
- Rationale: Supports scoped permissions, auditable changes, and long-term maintainability.
- Trade-offs: More schema and policy complexity up front.

**ADR-003: Shared commerce core, phased monetization rollout**
- Context: PRD lists subscriptions, digital products, sponsored placements, job board listings, paid upgrades
- Decision: Build shared commerce tables (`products`, `prices`, `orders`, `transactions`, `entitlements`) from day one, but activate subscriptions first.
- Rationale: Prevents payment-model rework and duplicated access-control logic as monetization expands.
- Trade-offs: More upfront schema before every monetization path is live.

**ADR-004: Versioned rubric model with normalized scoring**
- Context: PRD requires admin-defined scoring categories, weights, scales, and custom questions — cloneable across events
- Decision: Use versioned relational rubric tables and normalized score records; keep JSON only for flexible presentation metadata.
- Rationale: Better analytics, validation, exports, and auditability than an opaque JSON-only schema.
- Trade-offs: More tables and joins.

**ADR-005: Realtime is a projection, not the system of record**
- Context: PRD requires real-time scoring and audience feedback during live events
- Decision: All writes commit transactionally to Postgres. Supabase Realtime updates subscribed clients; polling is only a fallback display mechanism.
- Rationale: Live UX without making correctness depend on socket state.
- Trade-offs: Slightly more plumbing.

**ADR-006: Audience validation via public sessions, not fingerprinting**
- Context: PRD requires QR code access, optional anonymous submissions, duplicate prevention
- Decision: Public `/validate/[eventId]` route issues a server-created `audience_session`; dedup comes from unique constraints, optional email matching, and rate limits. Fingerprinting is secondary abuse detection only.
- Rationale: More privacy-safe and reliable than browser fingerprinting.
- Trade-offs: Slightly more bootstrap/session complexity.

**ADR-007: Durable background jobs for all side effects**
- Context: Emails, PDFs, assets, mentor matching, and webhook handling are unreliable in request time on Vercel
- Decision: Persist domain events to an outbox table and process them in a worker/queue with retries and dead-letter handling
- Rationale: Standard production pattern for reliability and operator visibility
- Trade-offs: Introduces worker infrastructure

**ADR-008: Email-first, defer SMS**
- Context: PRD lists both SendGrid and Twilio
- Decision: Launch with Resend/email; add SMS later when time-sensitive event notifications justify the cost/complexity
- Rationale: Lower integration surface area for the foundation
- Trade-offs: No SMS at launch

**ADR-009: Operational resilience and auditability for live events**
- Context: Live scoring and approvals are high-risk moments
- Decision: Optimistic local drafts, idempotent APIs, explicit scoring lock/publish states, immutable audit logs, operator-visible failure states
- Rationale: Protects correctness and traceability under pressure
- Trade-offs: More state-machine complexity

**ADR-010: Reports and generated artifacts are asynchronous stored outputs**
- Context: Founders need PDFs and the platform also needs generated media
- Decision: Generate reports/assets asynchronously in the worker tier and serve stored artifacts via signed URLs
- Rationale: Avoids request timeouts; makes artifacts retryable, cacheable, auditable
- Trade-offs: Eventual consistency for new artifacts

### Section: Operational Foundation

Explicitly call out:
- Reviewed migrations only
- Dev/staging/prod isolation
- Point-in-time recovery + restore drills
- Structured logs, metrics, error tracking, request/job correlation IDs
- Immutable audit logs
- Idempotency on webhooks and write APIs
- Signed URLs, upload limits, malware scanning, retention rules
- Feature-flagged rollouts for risky modules

### Section: Phased Delivery Plan

Restate the 3 phases from the PRD with the architecture decisions applied:

**Phase 1:** Database setup (Supabase + migrations), auth/RBAC, background job infrastructure, object storage, observability + audit logging, admin dashboard, founder application intake, judge scoring, event management

**Phase 2:** Audience validation (public routes + QR), founder portal with reporting (PDF generation), public founder directory (search, filter, shareable profiles), social asset generation (Satori), Stripe payments (checkout + subscriptions)

**Phase 3:** Mentor matching engine, additional revenue models (digital products, sponsored placements, job board, paid upgrades), advanced analytics, ecosystem intelligence exports

### Section: What Changes from the Original PRD

Honest section about what was refined, simplified, or deferred:
- WebSocket mention → Supabase Realtime (simpler, same result)
- Claims-only RBAC → database-backed authorization with scoped role assignments
- Opaque JSON rubric model → versioned rubric entities plus normalized score rows
- Audience fingerprint dedup → server-issued public sessions + unique constraints + rate limits
- Background jobs added as first-class architecture for all side effects
- Public founder directory timing clarified → ships with founder reporting/public profiles, not deferred to a later archive phase
- Revenue delivery narrowed, not the revenue data model → subscriptions first, but digital products/transactions stay modeled up front
- "SMS service such as Twilio" → deferred to post-Phase 1 (email-first, SMS adds cost and complexity)
- SendGrid → Resend or Supabase's built-in email (fewer integrations to manage)
- "Real-time response tracking" for audience → Supabase Realtime subscriptions (not raw WebSockets)
- Any other simplifications discovered during ADR writing

This section is important — it shows Abdul that the architecture is a thoughtful refinement, not a rubber stamp of the raw PRD.

---

## 3. Shared Styling

Both pages share the same CSS patterns. A single shared CSS module could work, or each page gets its own module with the same class names (matching the vision pattern where each page owns its styles).

Decision: Each page gets its own `page.module.css` with identical base classes. This matches how `/vision` and `/showcase` each have their own modules.

New classes shared across both pages:
- `.label` — uppercase monospace label above title
- `.navLink` — inline link to the sibling page (`font-size: 0.95rem`, `color: var(--accent)`, `text-decoration: underline`, `text-underline-offset: 2px`)

The architecture page additionally needs:
- `.adr` — ADR container (`margin: 1.5rem 0`, `padding: 1.25rem`, `border-radius: 8px`, `border: 1px solid var(--rule)`, `background: var(--surface)`)
- `.adrTitle` — ADR heading (`font-family: var(--font-mono)`, `font-size: 0.95rem`, `font-weight: 600`, `margin-bottom: 0.5rem`)
- `.adrMeta` — Context/Decision/Rationale/Trade-offs labels (`font-size: 0.85rem`, `font-weight: 600`, `color: var(--ink-muted)`, `text-transform: uppercase`, `letter-spacing: 0.04em`)

---

## 4. File Structure

```
studio/app/case-studies/aurrin-ventures/
  page.tsx              — partnership overview (Server Component)
  page.module.css       — styles for partnership page
  architecture/
    page.tsx            — technical architecture + ADRs (Server Component)
    page.module.css     — styles for architecture page
```

No layout files needed — both use root layout with StickyNav imported directly.

---

## 5. Content Sources

- Aurrin's PRD (provided in conversation) — scope, modules, data model, phases
- Aurrin's current app (`aurrin-app-v2`) — current stack context
- `/vision` page — linked for harness engineering thesis
- `docs/optimal-vision.md` — linked via GitHub URL for long-term direction
- gh-aw workflow names — from the prd-to-prod repo structure
- ADR content — derived from analyzing the PRD against realistic technical choices

---

## 6. What These Pages Are NOT

- Not sales pages with pricing or conversion CTAs
- Not publicly navigable — no nav links, accessed via direct URL only
- Not indexed by search engines (`robots: { index: false }`)
- Not a promise of a finished product — page 1 is explicitly honest about MVP quality
- The architecture page is not a binding contract — it's a refined starting point for discussion

---

## 7. Success Criteria

- Abdul reads page 1 and understands the partnership value: agent-first development, autonomous infrastructure, paradigm shift
- Abdul reads page 2 and sees his PRD refined into real architecture decisions with clear rationale
- The "What Changes" section on page 2 shows thoughtful refinement, not just restating the PRD
- Both pages link to each other for easy navigation
- Both pages match the prd-to-prod site aesthetic
- Neither page is discoverable via search engines or site navigation
