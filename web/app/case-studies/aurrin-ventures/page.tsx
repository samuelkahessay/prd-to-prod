import { Metadata } from "next";
import { StickyNav } from "@/components/landing/sticky-nav";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Aurrin Ventures x prd-to-prod",
  description:
    "How Aurrin Ventures is using autonomous delivery infrastructure to build a full-stack event and validation platform.",
  robots: { index: false, follow: false },
};

export default function AurrinVenturesCaseStudy() {
  return (
    <div className={styles.shell}>
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <article className={styles.article}>
          <span className={styles.label}>Case Study</span>

          <h1 className={styles.title}>
            Aurrin Ventures
            <br />
            &times; prd-to-prod
          </h1>

          <p className={styles.lede}>
            A Calgary startup accelerator evolving from a static site into a
            full-stack event and validation platform&mdash;built and maintained
            by an autonomous agent pipeline.
          </p>

          <hr className={styles.divider} />

          <h2>The challenge</h2>

          <p>
            Aurrin Ventures runs monthly pitch nights for early-stage founders in
            Calgary. They award microgrants, connect founders with judges and
            mentors, and track validation data from live audiences. Today, all of
            this runs on a Next.js marketing site with data stored in JSON files.
            Every content update requires a code change and a deploy.
          </p>

          <p>
            What they need is a platform: event management, founder applications,
            dynamic scoring rubrics, audience validation via QR codes, mentor
            matching, Stripe payments, downloadable reports, and a public founder
            directory. Twelve core modules, six user roles, three delivery
            phases, and fifteen-plus database entities.
          </p>

          <p>
            This is not a landing page refresh. It is a real product with
            authentication, real-time scoring, role-based access control, payment
            processing, and PDF generation.
          </p>

          <hr className={styles.divider} />

          <h2>Why agent-first development</h2>

          <p>
            The tools for autonomous software delivery exist now. GitHub shipped{" "}
            <a
              href="https://github.com/github/gh-aw"
              target="_blank"
              rel="noopener"
            >
              Agentic Workflows
            </a>{" "}
            in technical preview. Copilot agents can implement features from
            issue descriptions. Claude and Codex can review code, diagnose CI
            failures, and reason about architecture. These are not code
            generators&mdash;they are agents that operate inside governed
            pipelines.
          </p>

          <p>
            The traditional path for a project like Aurrin&rsquo;s: hire a
            development team or agency, manage sprints, coordinate reviews, fix
            CI manually, and lose all context when the engagement ends. Every
            change after launch requires going back to the same team or
            onboarding a new one.
          </p>

          <p>
            Agent-first development inverts this. You describe what you want as a
            GitHub issue. The pipeline decomposes it, assigns an agent to
            implement it, has a separate agent review it independently, merges
            when approved, deploys automatically, and self-heals when CI breaks.
            No sprint planning. No standups. No context loss.
          </p>

          <p>
            This is the same shift that happened with cloud infrastructure: from
            &ldquo;hire a sysadmin to rack servers&rdquo; to &ldquo;describe
            what you need and the platform provisions it.&rdquo; The
            infrastructure for software delivery is making the same transition.
          </p>

          <hr className={styles.divider} />

          <h2>What Aurrin gets</h2>

          <p>
            <strong>A rough MVP.</strong> Not a polished product&mdash;an honest
            first build. Auth, database, admin dashboard, core modules. The
            starting point, not the finish line.
          </p>

          <p>
            <strong>The autonomous delivery infrastructure.</strong> This is the
            real value. The repository comes with{" "}
            <code>gh-aw</code> workflows baked in:
          </p>

          <ul className={styles.list}>
            <li>
              <strong>Auto-dispatch</strong>&mdash;file a GitHub issue describing
              a feature or bug. The pipeline picks it up, assigns an agent, and
              begins implementation.
            </li>
            <li>
              <strong>Independent review</strong>&mdash;a separate agent reviews
              every PR. The builder and reviewer are never the same identity.
            </li>
            <li>
              <strong>Self-healing CI</strong>&mdash;when CI breaks, the pipeline
              detects the failure, creates a fix issue, assigns an agent, and
              resolves it. Often before anyone notices.
            </li>
            <li>
              <strong>Continuous documentation</strong>&mdash;agents update docs
              as they change code. Documentation does not drift.
            </li>
            <li>
              <strong>Complete audit trail</strong>&mdash;every decision (who
              approved what, why, what evidence was presented) is traceable in
              the repo history.
            </li>
            <li>
              <strong>Deploy on merge</strong>&mdash;approved PRs merge and
              deploy automatically. No manual deploy steps.
            </li>
          </ul>

          <p>
            The key point:{" "}
            <strong>
              Aurrin&rsquo;s team does not need to call a developer to make
              changes.
            </strong>{" "}
            They describe what they want in a GitHub issue. The pipeline ships
            it. This works on day one and continues working indefinitely.
          </p>

          <hr className={styles.divider} />

          <h2>The infrastructure</h2>

          <p>
            A brief look at what actually lives in the repository. Not
            exhaustive&mdash;enough to understand the machinery:
          </p>

          <ul className={styles.list}>
            <li>
              <code>auto-dispatch.yml</code>&mdash;routes labeled issues to the
              right agent
            </li>
            <li>
              <code>repo-assist</code>&mdash;the implementation agent that
              writes code from issue descriptions
            </li>
            <li>
              <code>pr-review-agent</code>&mdash;independent code review on
              every PR
            </li>
            <li>
              <code>ci-failure-issue.yml</code>&mdash;detects CI failures and
              creates fix issues automatically
            </li>
            <li>
              <strong>Autonomy policy</strong>&mdash;a machine-readable file
              defining what agents can and cannot do
            </li>
            <li>
              <strong>Identity separation</strong>&mdash;the agent that writes
              code never approves its own work
            </li>
          </ul>

          <p>
            For the full thesis on harness engineering&mdash;why the
            orchestration layer matters more than the model&mdash;read the{" "}
            <a href="/vision">vision</a>.
          </p>

          <hr className={styles.divider} />

          <h2>Where this goes</h2>

          <p>
            Aurrin is an early adopter of governed autonomous delivery. As
            the pipeline evolves:
          </p>

          <ul className={styles.list}>
            <li>
              The pipeline learns from its own history&mdash;which patterns
              break, which decompositions work best
            </li>
            <li>
              Policy becomes configurable&mdash;Aurrin can tighten or loosen
              governance as the platform matures
            </li>
            <li>
              Multi-service orchestration&mdash;as Aurrin grows beyond a single
              repo, the pipeline coordinates across services
            </li>
            <li>
              The ecosystem grows&mdash;better agents, specialized reviewers,
              marketplace templates
            </li>
          </ul>

          <p>
            The full unconstrained vision for where this leads is in the{" "}
            <a
              href="https://github.com/samuelkahessay/prd-to-prod/blob/main/docs/optimal-vision.md"
              target="_blank"
              rel="noopener"
            >
              optimal vision document
            </a>
            .
          </p>

          <hr className={styles.divider} />

          <p className={styles.closing}>
            Aurrin Ventures gets a platform and a pipeline. The platform is the
            starting point. The pipeline is what makes it self-sustaining.
          </p>

          <p>
            <a href="/case-studies/aurrin-ventures/architecture">
              Read the full technical architecture &rarr;
            </a>
          </p>
        </article>
      </main>
    </div>
  );
}
