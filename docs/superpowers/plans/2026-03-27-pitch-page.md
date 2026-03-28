# Pitch Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/pitch` one-pager for investor outreach and event applications.

**Architecture:** Static page following the existing article pattern from `/case-studies/aurrin-ventures`. Two files: `page.tsx` + `page.module.css`. No data fetching, no components. CSS modules with site design tokens.

**Tech Stack:** Next.js App Router, CSS Modules

**Spec:** `docs/superpowers/specs/2026-03-27-pitch-page-design.md`
**Mockup:** `.superpowers/brainstorm/73890-1774626935/content/pitch-v7.html`

---

### Task 1: Create pitch page CSS module

**Files:**
- Create: `web/app/pitch/page.module.css`

- [ ] **Step 1: Create the CSS module**

Copy the article page pattern from `web/app/case-studies/aurrin-ventures/page.module.css` and add the stat strip styles.

```css
.shell {
  min-height: 100vh;
}

.page {
  display: flex;
  justify-content: center;
  padding: 120px 24px 80px;
}

.article {
  max-width: 680px;
  width: 100%;
  font-size: 1.125rem;
  line-height: 1.75;
  color: var(--ink);
}

.article p {
  margin-bottom: 1.25em;
}

.article h2 {
  font-family: var(--font-sans);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 0.75em;
  color: var(--ink);
}

.label {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-faint);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 16px;
  display: block;
}

.title {
  font-family: var(--font-sans);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin-bottom: 1rem;
  color: var(--ink);
}

.lede {
  font-size: 1.25rem;
  line-height: 1.7;
  color: var(--ink-mid);
  margin-bottom: 2rem;
}

.stats {
  display: flex;
  gap: 1px;
  background: var(--rule);
  border: 1px solid var(--rule);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 2.5rem;
}

.stat {
  flex: 1;
  background: var(--warm-white);
  padding: 16px 20px;
  text-align: center;
}

.statNumber {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--ink);
  display: block;
}

.statLabel {
  font-size: 0.8rem;
  color: var(--ink-muted);
  margin-top: 2px;
}

.divider {
  border: none;
  border-top: 1px solid var(--rule);
  margin: 2.5rem 0;
}

.list {
  margin: 0 0 1.25em 1.5em;
  padding: 0;
}

.list li {
  margin-bottom: 0.5em;
}

.article code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--surface);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  border: 1px solid var(--rule);
}

.article a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.article a:hover {
  color: var(--ink);
}

.article strong {
  font-weight: 600;
}

.article em {
  font-style: italic;
}

.contact {
  font-size: 1rem;
  color: var(--ink-muted);
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .page {
    padding: 100px 20px 60px;
  }

  .title {
    font-size: 1.75rem;
  }

  .article {
    font-size: 1rem;
  }

  .article h2 {
    font-size: 1.25rem;
  }

  .stats {
    flex-direction: column;
  }

  .stat {
    padding: 12px 16px;
  }

  .statNumber {
    font-size: 1.25rem;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/pitch/page.module.css
git commit -m "style: add pitch page CSS module"
```

---

### Task 2: Create pitch page component

**Files:**
- Create: `web/app/pitch/page.tsx`

- [ ] **Step 1: Create the page**

Follow the same pattern as `web/app/case-studies/aurrin-ventures/page.tsx`. All content is static — no data fetching needed.

```tsx
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
            AI can write code. It can&rsquo;t ship software. We build the
            orchestration layer that turns capable agents into a governed,
            autonomous delivery pipeline.
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
              <span className={styles.statLabel}>Days</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>28</span>
              <span className={styles.statLabel}>Platform bugs found</span>
            </div>
          </div>

          <hr className={styles.divider} />

          <h2>Problem</h2>

          <p>
            Every company using AI to write code still needs engineers for
            everything around the code: decomposing specs, independent review,
            deployment, CI repair, and audit trails. The models are capable
            individually. The bottleneck is the orchestration&mdash;the
            infrastructure that wraps around agents to make them reliable and
            governable.
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
            loops with independent review on every fix. Agents operate inside
            the system, not above it.
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
            agent-merged PRs across 133 issues in 6 days so far. Build is
            ongoing.
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
            credits. Our depth-testing surfaced bugs that GitHub&rsquo;s own
            165-agent fleet didn&rsquo;t catch.
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
            active threads with Microsoft/GitHub&mdash;all initiated by the
            other side.
          </p>

          <hr className={styles.divider} />

          <h2>Market</h2>

          <p>
            GitHub has 100M+ developers and is actively building agent-native
            infrastructure. Factory raised $70M (Sequoia). Mendral (YC W26,
            Docker founders) is automating CI self-heal. The developer tooling
            market is converging on agent-first workflows, and the governance
            layer&mdash;who decides what ships, with what evidence&mdash;is
            where the opportunity is.
          </p>

          <hr className={styles.divider} />

          <h2>Business model</h2>

          <ul className={styles.list}>
            <li>
              <strong>Founder builds</strong> ($750&ndash;$5K)&mdash;we
              deliver a working app with the autonomous pipeline baked in
            </li>
            <li>
              <strong>Team setups</strong> ($3K&ndash;$7.5K +
              $1.5K/mo)&mdash;install the pipeline in an existing repo
            </li>
          </ul>

          <p>
            Services revenue today. The pipeline itself is the long-term
            product.
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
            &mdash;solo founder. Former Amazon SDE (Alexa Edge ML), ATB
            Financial (data science), University of Calgary research
            (algorithmic botany, NSERC grant). Currently full-stack developer
            at Upzoids building smart city platforms for Canadian
            municipalities.
          </p>

          <p>
            Built the pipeline, wrote the thesis, filed the upstream bugs,
            delivered the first client. Looking to bring on a co-founder with
            go-to-market or infrastructure experience as the product matures.
          </p>

          <hr className={styles.divider} />

          <h2>Ask: design partners</h2>

          <p>
            Looking for early-stage companies that need software built and want
            to be the first users of autonomous delivery infrastructure. Each
            engagement hardens the pipeline. Strongest fit: founders building
            on the standard SaaS stack (Next.js, Postgres, Stripe, auth).
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
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build
```

Expected: Build succeeds with no errors. The `/pitch` route is included in the output.

- [ ] **Step 3: Verify dev server**

```bash
cd web && npm run dev
```

Visit `http://localhost:3000/pitch`. Verify:
- Page renders with StickyNav
- Stat strip shows 4 stats in a row (stacks on mobile)
- All links work (Aurrin, gh-aw, blog posts, LinkedIn, email)
- Typography matches `/case-studies/aurrin-ventures`

- [ ] **Step 4: Commit**

```bash
git add web/app/pitch/page.tsx
git commit -m "feat(web): add /pitch one-pager for investor outreach"
```
