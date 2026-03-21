import { Metadata } from "next";
import { StickyNav } from "@/components/landing/sticky-nav";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Aurrin Platform — Technical Architecture",
  description:
    "Technical architecture, data model, and architecture decision records for the Aurrin Ventures event and validation platform.",
  robots: { index: false, follow: false },
};

export default function AurrinArchitecturePage() {
  return (
    <div className={styles.shell}>
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <article className={styles.article}>
          <span className={styles.label}>Technical Architecture</span>

          <h1 className={styles.title}>Aurrin Ventures Platform</h1>

          <p className={styles.lede}>
            The refined technical plan for Aurrin&rsquo;s event and validation
            platform. Architecture decisions, data model, and phased delivery.
          </p>

          <a
            href="/case-studies/aurrin-ventures"
            className={styles.navLink}
          >
            &larr; Read the partnership overview
          </a>

          <hr className={styles.divider} />

          {/* ── Architecture Overview ── */}

          <h2>Architecture overview</h2>

          <p>
            The platform is a full-stack Next.js application continuing
            Aurrin&rsquo;s existing framework. The major architectural shift is
            moving from JSON files to a managed database with proper auth and
            role-based access.
          </p>

          <ul className={styles.list}>
            <li>
              <strong>Application boundary:</strong> Next.js (App Router) for
              the web tier; business logic lives in domain services, not page
              components or route handlers.
            </li>
            <li>
              <strong>Database:</strong> PostgreSQL via Supabase for OLTP and
              source-of-truth transactional data
            </li>
            <li>
              <strong>Auth:</strong> Supabase Auth for identity; database-backed
              role assignments and RLS for authorization
            </li>
            <li>
              <strong>Async workflows:</strong> Durable job runner for webhooks,
              notifications, reports, social assets, mentor matching, and exports
            </li>
            <li>
              <strong>Storage:</strong> Object storage for pitch decks,
              generated PDFs, and social assets with signed URLs
            </li>
            <li>
              <strong>Payments:</strong> Stripe Billing + Checkout backed by a
              shared commerce model (products, orders, transactions,
              entitlements)
            </li>
            <li>
              <strong>Real-time:</strong> Supabase Realtime for subscriptions
              and live UI updates; Postgres remains the system of record
            </li>
            <li>
              <strong>Hosting:</strong> Vercel for the web tier; worker runtime
              can scale independently from the request/response path
            </li>
            <li>
              <strong>Email:</strong> Resend (replaces SendGrid&mdash;simpler,
              fewer integrations)
            </li>
            <li>
              <strong>Observability:</strong> Structured logs, audit events,
              metrics, error tracking, and restore-tested backups
            </li>
            <li>
              <strong>Social assets:</strong> Satori / <code>@vercel/og</code>{" "}
              for dynamic image generation
            </li>
          </ul>

          <hr className={styles.divider} />

          <h2>System boundaries</h2>

          <p>
            Long-term maintainability depends on not letting Next.js routes
            become the architecture. The platform should be implemented as
            bounded contexts with thin web handlers and explicit domain
            services.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Owns</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Identity &amp; Access</strong></td>
                  <td>
                    Supabase identity, user profiles, role assignments,
                    permission checks, active session context, admin access
                    changes.
                  </td>
                </tr>
                <tr>
                  <td><strong>Event Operations</strong></td>
                  <td>
                    Events, status windows, founder/judge assignments, rubric
                    publication, sponsorship placements, live-event controls.
                  </td>
                </tr>
                <tr>
                  <td><strong>Judging &amp; Rubrics</strong></td>
                  <td>
                    Rubric templates and versions, scoring drafts, scoring
                    locks, judge comments, ranking calculations.
                  </td>
                </tr>
                <tr>
                  <td><strong>Audience Validation</strong></td>
                  <td>
                    QR entry points, public validation sessions, dedup rules,
                    validation question sets, live aggregates.
                  </td>
                </tr>
                <tr>
                  <td><strong>Founder Outcomes</strong></td>
                  <td>
                    Founder portal, validation reports, public directory
                    publishing, public profiles, shareable highlights.
                  </td>
                </tr>
                <tr>
                  <td><strong>Commerce &amp; Entitlements</strong></td>
                  <td>
                    Products, prices, subscriptions, orders, transaction
                    ledger, premium access gating, digital-product fulfillment.
                  </td>
                </tr>
                <tr>
                  <td><strong>Notifications &amp; Media</strong></td>
                  <td>
                    Email/SMS orchestration, pitch deck uploads, generated
                    PDFs, social cards, file retention, delivery tracking.
                  </td>
                </tr>
                <tr>
                  <td><strong>Ops &amp; Compliance</strong></td>
                  <td>
                    Audit logs, exports, deletion workflows, metrics, alerts,
                    backups, restore drills, incident visibility.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr className={styles.divider} />

          {/* ── Data Model ── */}

          <h2>Data model</h2>

          <p>
            The original brief listed entity names without relationships. The
            refined model defines source-of-truth records, scoping rules, and
            operational tables needed for auditable production workflows.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Key Relationships</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Users</strong></td>
                  <td>
                    External identity from Supabase Auth plus human profile
                    fields. Authentication state lives here; authorization does
                    not.
                  </td>
                </tr>
                <tr>
                  <td><strong>RoleAssignments</strong></td>
                  <td>
                    User-to-role mapping with optional scope (global, event,
                    founder, subscriber). Source of truth for authorization,
                    RLS, and admin audit history.
                  </td>
                </tr>
                <tr>
                  <td><strong>Events</strong></td>
                  <td>
                    Status lifecycle: Upcoming &rarr; Live &rarr; Archived.
                    Owns judge assignments, founder pitches, validation config,
                    sponsorship slots, and scoring/publishing windows.
                  </td>
                </tr>
                <tr>
                  <td><strong>Rubrics</strong></td>
                  <td>
                    Template plus version tables. Live events reference an
                    immutable <code>rubric_version</code>. JSON is reserved for
                    presentation metadata, not the core scoring model.
                  </td>
                </tr>
                <tr>
                  <td><strong>FounderApplications</strong></td>
                  <td>
                    Status: Pending &rarr; Accepted &rarr; Assigned (to event)
                    or Declined. Acceptance creates a Founder account and sends
                    confirmation email.
                  </td>
                </tr>
                <tr>
                  <td><strong>FounderPitches</strong></td>
                  <td>
                    Join record between Founder and Event. Owns pitch deck
                    version, presentation order, score aggregates, validation
                    summary, public directory highlights, and publish state.
                  </td>
                </tr>
                <tr>
                  <td><strong>JudgeScores</strong></td>
                  <td>
                    Per-judge, per-founder_pitch, per-rubric_version. Stores
                    normalized question/category responses, calculated totals,
                    draft/submitted state, and revision history for audit.
                  </td>
                </tr>
                <tr>
                  <td><strong>AudienceSessions</strong></td>
                  <td>
                    Server-issued public participation session with consent,
                    rate-limit, dedup markers, and optional contact fields.
                  </td>
                </tr>
                <tr>
                  <td><strong>AudienceResponses</strong></td>
                  <td>
                    Per-audience_session, per-founder_pitch, per-question.
                    Unique constraints enforce one submission per founder/question
                    path; aggregate views are derived from these rows.
                  </td>
                </tr>
                <tr>
                  <td><strong>MentorMatches</strong></td>
                  <td>
                    Random pairing with repeat prevention (no same pair within
                    configurable period). Both parties accept/decline. Intro
                    email on mutual acceptance.
                  </td>
                </tr>
                <tr>
                  <td><strong>DigitalProducts</strong></td>
                  <td>
                    Admin-managed paid assets (maps, reports, downloads).
                    Linked to Stripe prices, fulfillment files, and purchaser
                    entitlements.
                  </td>
                </tr>
                <tr>
                  <td><strong>Subscriptions</strong></td>
                  <td>
                    Stripe-managed. Gates premium content. Status synced via
                    webhooks.
                  </td>
                </tr>
                <tr>
                  <td><strong>Transactions</strong></td>
                  <td>
                    Append-only ledger of Stripe events (checkout,
                    subscription, refund). Links users, subscriptions, and
                    digital products for reconciliation and export.
                  </td>
                </tr>
                <tr>
                  <td><strong>Files</strong></td>
                  <td>
                    Metadata for pitch decks, generated reports, and social
                    assets. Stores signed-url policy, retention rules, and
                    content ownership.
                  </td>
                </tr>
                <tr>
                  <td><strong>OutboxJobs</strong></td>
                  <td>
                    Durable async workflow state for notifications, PDFs,
                    social assets, exports, mentor matching, and webhook
                    processing.
                  </td>
                </tr>
                <tr>
                  <td><strong>AuditLogs</strong></td>
                  <td>
                    Immutable actor/action/effect records for approvals, role
                    changes, score locks, entitlement changes, and exports.
                  </td>
                </tr>
                <tr>
                  <td><strong>Sponsors</strong></td>
                  <td>
                    Placement per event or site-wide. Admin-managed. No
                    self-serve.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr className={styles.divider} />

          {/* ── Role Access ── */}

          <h2>Role access matrix</h2>

          <p>
            The original brief mentioned role-based access everywhere but never
            defined who can see what. These are product decisions, not
            implementation details, and they need to be specified upfront.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Who Can See It</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Individual judge scores</td>
                  <td>The judge who submitted them + Admin. Not other judges. Founders see them only after scoring is locked and results are published.</td>
                </tr>
                <tr>
                  <td>Aggregated judge scores</td>
                  <td>Founders see their own aggregate + breakdown after scoring is locked and published. Admin sees all.</td>
                </tr>
                <tr>
                  <td>Audience validation data</td>
                  <td>Founders see their own results after admin publish or automatic post-event release. Admin sees all. Public directory shows curated highlights only.</td>
                </tr>
                <tr>
                  <td>Founder applications</td>
                  <td>Admin only. Founders see their own application status.</td>
                </tr>
                <tr>
                  <td>Role assignments and access policies</td>
                  <td>Admin only. Every change is audited. Users never edit their own effective permissions directly.</td>
                </tr>
                <tr>
                  <td>Other founders&rsquo; profiles</td>
                  <td>Public directory shows approved public data. Founders cannot see each other&rsquo;s scores or validation.</td>
                </tr>
                <tr>
                  <td>Mentor matching data</td>
                  <td>Admin sees all matches. Mentors see only their own pending or accepted matches. Founders see only their own mentor assignments and contact details after mutual acceptance.</td>
                </tr>
                <tr>
                  <td>Premium content and digital products</td>
                  <td>Subscribers see the premium content, downloads, and purchase history they are entitled to. Admin sees all orders and entitlements. Non-subscribers see previews only.</td>
                </tr>
                <tr>
                  <td>Event management</td>
                  <td>Admin only. Judges see their assigned events. Founders see events they are assigned to.</td>
                </tr>
                <tr>
                  <td>Revenue / transactions / entitlements</td>
                  <td>Admin only for full financial records. Subscribers see only their own subscriptions, orders, and entitlements.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr className={styles.divider} />

          {/* ── ADRs ── */}

          <h2>Architecture decision records</h2>

          {/* ADR-001 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-001: Supabase over raw PostgreSQL</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                The brief says &ldquo;managed database such as PostgreSQL via
                Supabase or similar.&rdquo;
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Supabase.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                Includes auth, realtime, storage, and row-level security out of
                the box. Reduces the number of services to integrate.
                Aurrin&rsquo;s team (non-technical operators) benefits from the
                Supabase dashboard for direct data inspection when needed.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                Vendor coupling to Supabase. Auth and realtime are good but not
                infinitely flexible. Acceptable for this scale.
              </p>
            </div>
          </div>

          {/* ADR-002 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-002: Supabase Auth for identity, database-backed RBAC for authorization</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                Six user roles with route-level and data-level access control,
                and some people may wear more than one hat at the same time.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Use Supabase Auth for authentication, but store role
                assignments and scopes in relational tables. JWT claims identify
                the user and can cache coarse context; RLS resolves effective
                permissions from the database.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                This supports concurrent roles, event-scoped permissions,
                auditable admin reassignment, and safer long-term evolution than
                treating auth metadata as the source of truth.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                More schema and policy complexity up front. Permission changes
                need careful cache invalidation / token refresh handling.
              </p>
            </div>
          </div>

          {/* ADR-003 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-003: Shared commerce core, phased monetization rollout</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                The brief lists five revenue models: premium subscriptions,
                digital map purchases, sponsored placements, job board listings,
                and paid founder upgrades. Each needs its own Stripe logic, admin
                UI, and access control.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Build a shared commerce foundation (<code>products</code>,{" "}
                <code>prices</code>, <code>orders</code>,{" "}
                <code>transactions</code>, <code>entitlements</code>) from day
                one, but activate premium subscriptions first. Additional
                revenue models reuse the same ledger and entitlement model.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                This avoids rebuilding access control, reconciliation, exports,
                and admin tooling every time a new monetization path ships.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                More upfront schema than a subscription-only MVP. Worth it to
                avoid payment-model rework later.
              </p>
            </div>
          </div>

          {/* ADR-004 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-004: Versioned rubric model with normalized scoring</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                Admin needs to define scoring categories, weights, scales, and
                custom questions&mdash;cloneable across events. The system also
                needs analytics, exports, and auditability when rubrics change.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Store rubric definitions in versioned relational tables. Use
                JSON only for flexible presentation metadata. When an event goes
                Live, it binds to an immutable <code>rubric_version</code>.
                Scores are recorded as normalized responses with calculated
                aggregate snapshots.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                This is more analytics-friendly, migration-safe, and auditable
                than an opaque JSONB-only schema while still supporting dynamic
                rendering in the scoring UI.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                More tables and joins than a single schema column. Worth it for
                long-term reporting and change control.
              </p>
            </div>
          </div>

          {/* ADR-005 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-005: Realtime is a projection, not the system of record</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                The brief mentions WebSockets for real-time scoring and audience
                validation. Live UX matters, but correctness cannot depend on a
                socket staying open.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                All writes go through transactional database endpoints with
                optimistic concurrency and idempotency keys. Supabase Realtime
                broadcasts committed changes to subscribed clients. Polling is a
                fallback display strategy, not the correctness model.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                This gives the UI a real-time feel without making delivery
                dependent on ephemeral connection state. Correctness stays in
                Postgres.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                Slightly more plumbing than naive socket-first updates. Worth it
                because data integrity survives reconnects and transient outages.
              </p>
            </div>
          </div>

          {/* ADR-006 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-006: Audience validation via public sessions, not fingerprinting</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                Audience members scan a QR code and submit validation feedback.
                The brief requires optional anonymous submissions and duplicate
                prevention.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Public <code>/validate/[eventId]</code> route. The server issues
                an <code>audience_session</code> and signed cookie/token on
                entry. Dedup is enforced with unique constraints plus optional
                email matching and rate limits. Fingerprinting, if used at all,
                is only secondary abuse detection.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                Server-controlled session identity is more reliable, more
                privacy-conscious, and easier to reason about under GDPR than
                browser fingerprinting as a primary control.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                Slightly more bootstrap complexity and device-cookie handling.
                Still the right trade-off for trustworthy validation data.
              </p>
            </div>
          </div>

          {/* ADR-007 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-007: Durable background jobs for all side effects</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                Emails, PDFs, social assets, mentor matching, Stripe webhooks,
                and exports should not rely on the request/response lifecycle,
                especially on Vercel.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Persist domain events to an outbox table and process them with a
                dedicated worker/queue. All jobs are idempotent, retryable, and
                dead-lettered for operator intervention when necessary.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                Durable jobs survive retries, deploys, and live-event traffic
                spikes. They also give operators a single place to inspect
                side-effect failures.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                Introduces worker infrastructure and more operational surface
                area. Necessary for production-grade reliability.
              </p>
            </div>
          </div>

          {/* ADR-008 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-008: Email-first, defer SMS</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                The brief lists both SendGrid for email and Twilio for SMS as
                required integrations.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Use Resend for email (simpler API, fewer integrations to
                manage). Defer SMS (Twilio) to post-Phase 1. Email covers all
                critical notifications.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                SMS adds cost per message and a separate integration to maintain.
                Every notification in the brief can be delivered via email. SMS
                can be layered in later for time-sensitive alerts (live event
                start) once the core platform is stable.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                No SMS for launch. Email delivery is subject to spam filters.
                Acceptable trade-off&mdash;reduces integration surface area for
                the initial build.
              </p>
            </div>
          </div>

          {/* ADR-009 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-009: Operational resilience and auditability for live events</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                Live events, approvals, score changes, and billing entitlements
                are the highest-risk moments. They need explicit resilience and
                audit rules.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Use optimistic local scoring drafts, idempotent submission APIs,
                explicit scoring lock/publish states, immutable audit logs for
                approvals and entitlement changes, and operator-visible failure
                states for jobs and integrations.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                A network blip should not lose scores, and a human operator
                should always be able to explain who changed what and when.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                More state machines, retry logic, and audit volume. Worth it for
                correctness under pressure.
              </p>
            </div>
          </div>

          {/* ADR-010 */}
          <div className={styles.adr}>
            <div className={styles.adrTitle}>ADR-010: Reports and generated artifacts are asynchronous stored outputs</div>
            <div className={styles.adrBody}>
              <p>
                <span className={styles.adrMeta}>Context: </span>
                Founders need downloadable validation reports, and the platform
                also needs generated social assets and reusable exports.
              </p>
              <p>
                <span className={styles.adrMeta}>Decision: </span>
                Use <code>@react-pdf/renderer</code> and{" "}
                <code>@vercel/og</code>, but generate artifacts asynchronously
                in the worker tier, store them in object storage, and serve them
                via signed URLs. API routes request generation or fetch existing
                artifacts; they do not render heavy outputs inline.
              </p>
              <p>
                <span className={styles.adrMeta}>Rationale: </span>
                This avoids request timeouts and makes artifacts cacheable,
                retryable, and auditable.
              </p>
              <p>
                <span className={styles.adrMeta}>Trade-offs: </span>
                Eventual consistency: newly requested artifacts may take seconds
                to appear. Acceptable for reports and share assets.
              </p>
            </div>
          </div>

          <hr className={styles.divider} />

          <h2>Operational foundation</h2>

          <p>
            If this is the base of a skyscraper, these practices are not
            optional extras. They are part of the architecture.
          </p>

          <ul className={styles.list}>
            <li>All schema changes ship through reviewed migrations. No production-only dashboard edits.</li>
            <li>Dev, staging, and prod stay isolated, with seeded fixtures for realistic test runs.</li>
            <li>Point-in-time recovery is enabled and restore drills are practiced on a schedule.</li>
            <li>Request IDs and job IDs flow through logs, metrics, and error tracking for traceability.</li>
            <li>Admin decisions, scoring locks, entitlement changes, and exports write immutable audit events.</li>
            <li>Stripe webhooks, validation responses, and scoring submissions use idempotency keys and replay-safe handlers.</li>
            <li>Uploads use signed URLs, file type/size limits, malware scanning, and retention rules.</li>
            <li>Risky features such as payments, live scoring, and directory publishing are rollout-controlled with feature flags.</li>
          </ul>

          <hr className={styles.divider} />

          {/* ── Phased Delivery ── */}

          <h2>Phased delivery</h2>

          <p>
            Each phase is delivered as a set of GitHub issues. The pipeline
            decomposes, implements, reviews, merges, and deploys each module
            independently.
          </p>

          <div className={styles.phase}>
            <span className={styles.phaseLabel}>Phase 1 &mdash; Foundation</span>
            <ul className={styles.list}>
              <li>Database setup (Supabase, schema, RLS policies, migration pipeline)</li>
              <li>Authentication + authorization (Supabase Auth + scoped role assignments)</li>
              <li>Background job infrastructure (outbox + worker)</li>
              <li>Object storage and upload pipeline (decks, generated artifacts)</li>
              <li>Observability + audit logging</li>
              <li>Admin dashboard (event CRUD, rubric builder, founder management)</li>
              <li>Founder application intake (public form, approval workflow, auto-account creation)</li>
              <li>Judge scoring (dynamic rubric rendering, weighted totals, comments)</li>
              <li>Event management (status lifecycle, judge/founder assignment)</li>
            </ul>
          </div>

          <div className={styles.phase}>
            <span className={styles.phaseLabel}>Phase 2 &mdash; Validation + Revenue</span>
            <ul className={styles.list}>
              <li>Audience validation (public routes, QR codes, configurable questions, dedup)</li>
              <li>Founder portal (score breakdown, validation results, downloadable PDF/CSV)</li>
              <li>Public founder directory (search, filter, shareable profiles)</li>
              <li>Social asset generation (Satori for milestone images)</li>
              <li>Stripe integration (premium subscriptions first, with the commerce data model ready for digital products)</li>
            </ul>
          </div>

          <div className={styles.phase}>
            <span className={styles.phaseLabel}>Phase 3 &mdash; Growth</span>
            <ul className={styles.list}>
              <li>Mentor matching engine (random pairing, repeat prevention, acceptance flow)</li>
              <li>Additional revenue models (digital products, sponsored placements, job board, paid founder upgrades)</li>
              <li>Advanced analytics (cross-event trends, cohort analysis)</li>
              <li>Ecosystem intelligence exports</li>
            </ul>
          </div>

          <hr className={styles.divider} />

          {/* ── What Changed ── */}

          <h2>What changed from the original brief</h2>

          <p>
            The brief was strong on vision and user experience. These
            refinements are about making it buildable and resilient:
          </p>

          <ul className={styles.list}>
            <li>
              <strong>Data relationships defined</strong>&mdash;the brief listed
              entity names. This architecture defines the actual relationships:
              founders can pitch multiple events, rubrics freeze on go-live,
              scores reference frozen rubrics.
            </li>
            <li>
              <strong>Role access spelled out</strong>&mdash;who sees what is now
              a defined matrix, not an implicit assumption. Judges cannot see
              each other&rsquo;s scores. Founders see aggregates only after the
              publish state allows it. Mentor and subscriber access is defined
              explicitly instead of being implied.
            </li>
            <li>
              <strong>Claims-only RBAC replaced with database-backed
              authorization</strong>&mdash;identity comes from Supabase Auth,
              but permissions live in relational role assignments that can be
              scoped and audited.
            </li>
            <li>
              <strong>Rubrics moved from opaque JSON toward a versioned domain
              model</strong>&mdash;dynamic rendering still works, but analytics,
              exports, and score locking now rest on normalized structures.
            </li>
            <li>
              <strong>Realtime is treated as delivery, not correctness</strong>&mdash;Supabase
              Realtime updates the UI, but committed database writes remain the
              source of truth.
            </li>
            <li>
              <strong>Audience dedup no longer depends on fingerprinting</strong>&mdash;public
              sessions, unique constraints, and rate limits are the primary
              controls.
            </li>
            <li>
              <strong>Background jobs are now first-class architecture</strong>&mdash;notifications,
              reports, assets, exports, and webhook handling run through durable
              async workflows instead of request-time side effects.
            </li>
            <li>
              <strong>Revenue delivery narrowed, not the revenue data model</strong>&mdash;premium
              subscriptions ship first, but digital products and transactions
              stay in the schema from day one to avoid payment-model rework.
            </li>
            <li>
              <strong>SMS deferred</strong>&mdash;email handles all
              notifications. Twilio/SMS is a Phase 3+ addition once the core is
              stable.
            </li>
            <li>
              <strong>SendGrid replaced with Resend</strong>&mdash;simpler API,
              fewer integrations.
            </li>
            <li>
              <strong>Public founder directory timing clarified</strong>&mdash;it
              ships with founder reporting in Phase 2, because public profiles,
              validation highlights, and shareable links ride on the same
              publishing pipeline.
            </li>
            <li>
              <strong>Failure handling added</strong>&mdash;the brief assumed
              100% uptime. This architecture defines what happens when scoring,
              payments, uploads, or notification jobs go down.
            </li>
          </ul>
        </article>
      </main>
    </div>
  );
}
