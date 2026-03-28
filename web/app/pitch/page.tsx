import { Metadata } from "next";
import { StickyNav } from "@/components/landing/sticky-nav";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Pitch — prd-to-prod",
  description:
    "Autonomous delivery infrastructure for AI agents. One-pager.",
  robots: { index: false, follow: false },
};

export default function PitchPage() {
  return (
    <div className={styles.shell}>
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <article className={styles.article}>
          <span className={styles.label}>prd-to-prod</span>

          <h1 className={styles.title}>
            The delivery infrastructure
            <br />
            for AI agents.
          </h1>

          <p className={styles.lede}>
            AI agents can write code, but shipping software requires
            decomposing specs, independent review, deployment, CI repair, and
            audit trails. We build the orchestration layer that governs the
            full pipeline.
          </p>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>80</span>
              <span className={styles.statLabel}>Agent-merged PRs</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>12</span>
              <span className={styles.statLabel}>Modules delivered</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>6</span>
              <span className={styles.statLabel}>First 6 days</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>28</span>
              <span className={styles.statLabel}>Platform bugs found</span>
            </div>
          </div>

          <hr className={styles.divider} />

          <h2>Problem</h2>

          <p>
            Companies using AI to write code still hire engineers for
            the work around it: decomposing specs into parallelizable tasks,
            reviewing code where the reviewer is independent from the author,
            deploying, repairing CI failures, and maintaining audit trails.
            The models are capable. The orchestration around them is the
            bottleneck.
          </p>

          <hr className={styles.divider} />

          <h2>Solution</h2>

          <p>
            <code>prd-to-prod</code> is an autonomous delivery pipeline built
            on GitHub&rsquo;s{" "}
            <a
              href="https://github.github.com/gh-aw/"
              target="_blank"
              rel="noopener"
            >
              Agentic Workflows
            </a>
            . You file a product brief as a GitHub issue. The pipeline
            decomposes it into tasks, assigns agents to implement each one, has
            a separate agent review every PR, merges on approval, deploys, and
            self-heals when CI breaks.
          </p>

          <p>
            The governance layer is repo-owned: an autonomy policy defining
            what agents can and cannot do, identity separation between builder
            and reviewer, dependency-aware orchestration, and self-healing
            loops with independent review on every fix.
          </p>

          <hr className={styles.divider} />

          <h2>Traction</h2>

          <p>
            <strong>First client build:</strong>{" "}
            <a
              href="https://www.aurrinventures.ca/"
              target="_blank"
              rel="noopener"
            >
              Aurrin Ventures
            </a>
            , a Calgary startup accelerator, is replacing a static site with a
            12-module platform (event management, judge scoring, audience
            validation, mentor matching, Stripe payments, public directory). 80
            agent-merged PRs across 133 issues in its first 6 days, as of March
            27, 2026. Build is ongoing.
          </p>

          <p>
            <strong>Platform credibility:</strong> Top 3 leading community
            contributor to GitHub{" "}
            <a
              href="https://github.github.com/gh-aw/"
              target="_blank"
              rel="noopener"
            >
              Agentic Workflows
            </a>
            . 28 issues filed, 24 fixes shipped across 8 releases, 15 release
            credits. We surfaced bugs that GitHub&rsquo;s own 165-agent fleet
            did not catch.
          </p>

          <p>
            <strong>Signal:</strong>{" "}
            <a
              href="https://skahessay.dev/posts/the-new-oss"
              target="_blank"
              rel="noopener"
            >
              &ldquo;The New OSS&rdquo;
            </a>{" "}
            endorsed by Peli de Halleux (gh-aw creator, Microsoft Research),
            amplified by GitHub Next.{" "}
            <a
              href="https://skahessay.dev/posts/the-agent-interface"
              target="_blank"
              rel="noopener"
            >
              &ldquo;The Agent Interface&rdquo;
            </a>{" "}
            reposted by Don Syme (F# creator, Microsoft Research). Three
            active threads with Microsoft/GitHub, all initiated by the other
            side.
          </p>

          <hr className={styles.divider} />

          <h2>Market</h2>

          <p>
            The first buyers are founders and small product teams building on
            the standard SaaS stack who need to ship software without hiring a
            full engineering team for every change. Code generation is
            commoditized. Orchestration, review, deploy, and recovery are not.
          </p>

          <p>
            GitHub has 100M+ developers and is building agent-native
            infrastructure. Factory raised $70M. Mendral is automating CI
            self-heal. These companies are solving pieces of agent-first
            delivery. The governance layer is unsolved.
          </p>

          <hr className={styles.divider} />

          <h2>Business model</h2>

          <ul className={styles.list}>
            <li>
              <strong>Paid initial engagements.</strong> We either deliver a
              working app with the pipeline baked in or install the pipeline in
              an existing repo.
            </li>
            <li>
              <strong>Expansion revenue.</strong> Recurring software revenue
              for orchestration, policy controls, review boundaries, and
              self-healing workflows.
            </li>
          </ul>

          <p>
            Services fund the wedge. The long-term product is the control plane
            for governed autonomous delivery.
          </p>

          <hr className={styles.divider} />

          <h2>Team</h2>

          <p>
            <strong>
              <a
                href="https://linkedin.com/in/samuelkahessay"
                target="_blank"
                rel="noopener"
              >
                Samuel Kahessay
              </a>
            </strong>

            . Solo founder. Former Amazon SDE (Alexa Edge ML), ATB Financial
            (data science), University of Calgary researcher (NSERC grant).
          </p>

          <p>
            Built the pipeline, wrote the thesis, surfaced upstream platform
            bugs, and delivered the first client.
          </p>

          <hr className={styles.divider} />

          <h2>Ask: design partners</h2>

          <p>
            Looking for early-stage companies that need to ship software and
            want to be early users of autonomous delivery infrastructure. Each
            engagement hardens the product. Strongest fit: founders building on
            the standard SaaS stack (Next.js, Postgres, Stripe, auth).
          </p>

          <p>
            Also building relationships with investors who understand developer
            tooling, workflow infrastructure, and AI systems.
          </p>

          <p className={styles.contact}>
            <a href="mailto:kahessay@icloud.com">kahessay@icloud.com</a>
            &ensp;&bull;&ensp;
            <a
              href="https://linkedin.com/in/samuelkahessay"
              target="_blank"
              rel="noopener"
            >
              LinkedIn
            </a>
            &ensp;&bull;&ensp;
            <a href="https://prdtoprod.com">prdtoprod.com</a>
          </p>
        </article>
      </main>
    </div>
  );
}
