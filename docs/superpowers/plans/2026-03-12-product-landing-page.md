# Product Landing Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the prd-to-prod landing page from a technical showcase into a product page with two service offerings, sticky nav, and buyer-focused messaging.

**Architecture:** Next.js 16 app in `studio/` using CSS modules + server components. All landing page components live in `studio/components/landing/`. The page is server-rendered with one async data fetch (`fetchEvidenceData()`). One new client component (sticky nav with scroll detection). Existing `PipelineAnimation` client component reused in a new location.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, CSS Modules

**Spec:** `docs/superpowers/specs/2026-03-12-product-landing-page-design.md`

---

## Chunk 1: Foundation — Global Styles + Sticky Nav + Hero Rewrite

### Task 1: Add smooth scrolling to globals.css

**Files:**
- Modify: `studio/app/globals.css`

- [ ] **Step 1: Add scroll-behavior rule**

Add to `studio/app/globals.css`, inside the existing `body` block or as a new `html` rule at the top of the file (after `:root`):

```css
html {
  scroll-behavior: smooth;
  scroll-padding-top: 72px;
}
```

The `scroll-padding-top` offsets anchor scroll targets so they don't land behind the fixed sticky nav (~56px nav height + 16px breathing room).

- [ ] **Step 2: Verify build**

Run: `cd studio && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add studio/app/globals.css
git commit -m "feat: add smooth scroll behavior for anchor navigation"
```

---

### Task 2: Create sticky nav component

**Files:**
- Create: `studio/components/landing/sticky-nav.tsx`
- Create: `studio/components/landing/sticky-nav.module.css`

- [ ] **Step 1: Create the CSS module**

Create `studio/components/landing/sticky-nav.module.css`:

```css
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 48px;
  background: transparent;
  transition: background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease;
  border-bottom: 1px solid transparent;
}

.scrolled {
  background: rgba(247, 244, 240, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom-color: var(--rule);
}

.logo {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.links {
  display: flex;
  align-items: center;
  gap: 28px;
}

.link {
  font-size: 13px;
  color: var(--ink-muted);
  text-decoration: none;
}

.link:hover {
  color: var(--ink);
}

.cta {
  display: inline-block;
  background: var(--ink);
  color: var(--cream);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  text-decoration: none;
  letter-spacing: 0.01em;
}

@media (max-width: 768px) {
  .nav {
    padding: 14px 24px;
  }
  .links .link {
    display: none;
  }
}
```

- [ ] **Step 2: Create the component**

Create `studio/components/landing/sticky-nav.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./sticky-nav.module.css";

const MAILTO = "mailto:sam@skahessay.dev?subject=PRD%20Submission";

export function StickyNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <a href="/" className={styles.logo}>prd-to-prod</a>
      <div className={styles.links}>
        <a href="#pricing" className={styles.link}>Pricing</a>
        <a href="#how-it-works" className={styles.link}>How it works</a>
        <a href="#for-teams" className={styles.link}>For Teams</a>
        <a
          href="https://github.com/samuelkahessay/prd-to-prod"
          className={styles.link}
          target="_blank"
          rel="noopener"
        >
          GitHub
        </a>
        <a href={MAILTO} className={styles.cta}>Send your PRD →</a>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd studio && npm run build`
Expected: Build succeeds (component not yet mounted, just verifying it compiles)

- [ ] **Step 4: Commit**

```bash
git add studio/components/landing/sticky-nav.tsx studio/components/landing/sticky-nav.module.css
git commit -m "feat: create sticky nav component with scroll detection"
```

---

### Task 3: Rewrite the hero component

**Files:**
- Modify: `studio/components/landing/hero.tsx`
- Modify: `studio/components/landing/hero.module.css`

- [ ] **Step 1: Rewrite hero.module.css**

Replace the entire contents of `studio/components/landing/hero.module.css` with:

```css
.hero {
  padding: 120px 48px 60px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 16px;
}

.headline {
  font-size: clamp(42px, 5.5vw, 64px);
  font-weight: 900;
  line-height: 1.0;
  letter-spacing: -0.03em;
  margin-bottom: 24px;
  max-width: 560px;
}

.line2 {
  display: block;
  color: var(--ink-mid);
  font-weight: 300;
  font-style: italic;
}

.subtitle {
  font-size: 16px;
  font-weight: 400;
  color: var(--ink-muted);
  max-width: 440px;
  line-height: 1.6;
  margin-bottom: 32px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.ctaPrimary {
  display: inline-block;
  background: var(--ink);
  color: var(--cream);
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.01em;
  text-decoration: none;
}

.ctaLink {
  font-size: 14px;
  color: var(--ink-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 768px) {
  .hero {
    padding: 100px 24px 48px;
  }
}
```

- [ ] **Step 2: Rewrite hero.tsx**

Replace the entire contents of `studio/components/landing/hero.tsx` with:

```tsx
import styles from "./hero.module.css";

const MAILTO = "mailto:sam@skahessay.dev?subject=PRD%20Submission";

export function Hero() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Powered by GitHub Agentic Workflows</p>
      <h1 className={styles.headline}>
        Send a PRD.
        <span className={styles.line2}>Get a deployed app.</span>
      </h1>
      <p className={styles.subtitle}>
        Autonomous agents build, review, and deploy your app from your PRD.
        You get a live URL, a real repo with CI/CD, and code you own.
        First project free.
      </p>
      <div className={styles.actions}>
        <a href={MAILTO} className={styles.ctaPrimary}>Send your PRD →</a>
        <a href="#pricing" className={styles.ctaLink}>See pricing</a>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd studio && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add studio/components/landing/hero.tsx studio/components/landing/hero.module.css
git commit -m "feat: rewrite hero with buyer-focused copy and CTAs"
```

---

## Chunk 2: New Sections — Pricing + What You Get

### Task 4: Create the pricing component

**Files:**
- Create: `studio/components/landing/pricing.tsx`
- Create: `studio/components/landing/pricing.module.css`

- [ ] **Step 1: Create pricing.module.css**

Create `studio/components/landing/pricing.module.css`:

```css
.section {
  padding: 80px 48px 0;
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

.heading {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 15px;
  color: var(--ink-muted);
  margin-bottom: 40px;
  max-width: 480px;
  line-height: 1.5;
}

.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  max-width: 720px;
}

.card {
  background: var(--warm-white);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 32px;
}

.cardPrimary {
  border: 2px solid var(--ink);
  position: relative;
}

.badge {
  position: absolute;
  top: -11px;
  left: 20px;
  background: var(--ink);
  color: var(--cream);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 3px 10px;
  text-transform: uppercase;
  font-family: var(--font-mono);
}

.cardLabel {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.price {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.priceUnit {
  font-size: 16px;
  font-weight: 400;
  color: var(--ink-muted);
}

.pricePer {
  font-size: 13px;
  color: var(--ink-muted);
  margin-bottom: 20px;
}

.features {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--ink-mid);
  line-height: 2;
}

.featureMuted {
  color: var(--ink-muted);
}

.tiers {
  border-top: 1px solid var(--rule);
  padding-top: 16px;
  margin-bottom: 20px;
}

.tiersTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 6px;
}

.tier {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--ink-muted);
  line-height: 1.8;
}

.tierPrice {
  font-family: var(--font-mono);
}

.ctaPrimary {
  display: block;
  text-align: center;
  background: var(--ink);
  color: var(--cream);
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  text-decoration: none;
}

.ctaOutline {
  display: block;
  text-align: center;
  background: transparent;
  color: var(--ink);
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  text-decoration: none;
  border: 1.5px solid var(--ink);
}

.subCta {
  text-align: center;
  font-size: 12px;
  color: var(--ink-faint);
  margin-top: 8px;
}

.scope {
  max-width: 720px;
  margin-top: 32px;
  padding: 20px;
  background: var(--surface);
  border-radius: 6px;
}

.scopeTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 8px;
}

.scopeBody {
  font-size: 13px;
  color: var(--ink-muted);
  line-height: 1.6;
}

@media (max-width: 768px) {
  .section {
    padding: 60px 24px 0;
  }
  .cards {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create pricing.tsx**

Create `studio/components/landing/pricing.tsx`:

```tsx
import styles from "./pricing.module.css";

const MAILTO = "mailto:sam@skahessay.dev?subject=PRD%20Submission";

export function Pricing() {
  return (
    <section id="pricing" className={styles.section}>
      <span className={styles.label}>Pricing</span>
      <h2 className={styles.heading}>Pricing</h2>
      <p className={styles.subtitle}>
        Your first project is free — so you can see exactly what the pipeline
        delivers before paying for anything.
      </p>

      <div className={styles.cards}>
        {/* Card A — Offer A (primary) */}
        <div className={`${styles.card} ${styles.cardPrimary}`}>
          <div className={styles.badge}>Most popular</div>
          <p className={styles.cardLabel}>Send a PRD</p>
          <div className={styles.price}>
            $500<span className={styles.priceUnit}>–$2K</span>
          </div>
          <p className={styles.pricePer}>per project</p>

          <ul className={styles.features}>
            <li>✓ Deployed app on Vercel with live URL</li>
            <li>✓ Real GitHub repo you own</li>
            <li>✓ CI/CD pipeline included</li>
            <li>✓ Production-grade code — reviewed, tested, merged</li>
            <li>✓ Self-healing CI — failures get fixed automatically</li>
            <li className={styles.featureMuted}>~ 24–48 hour turnaround</li>
          </ul>

          <div className={styles.tiers}>
            <p className={styles.tiersTitle}>Complexity tiers</p>
            <div className={styles.tier}>
              <span>Simple app / internal tool</span>
              <span className={styles.tierPrice}>$500</span>
            </div>
            <div className={styles.tier}>
              <span>Multi-feature with integrations</span>
              <span className={styles.tierPrice}>$1K–$1.5K</span>
            </div>
            <div className={styles.tier}>
              <span>Complex (auth, multiple APIs)</span>
              <span className={styles.tierPrice}>$2K</span>
            </div>
          </div>

          <a href={MAILTO} className={styles.ctaPrimary}>Send your PRD →</a>
          <p className={styles.subCta}>First project free — no card required</p>
        </div>

        {/* Card B — Offer B (secondary) */}
        <div id="for-teams" className={styles.card}>
          <p className={styles.cardLabel}>For engineering teams</p>
          <div className={styles.price}>
            $2K<span className={styles.priceUnit}>–$5K</span>
          </div>
          <p className={styles.pricePer}>one-time setup</p>

          <ul className={styles.features}>
            <li>✓ Autonomous pipeline on your repo</li>
            <li>✓ Issues → agents → PRs → review → merge</li>
            <li>✓ CI failure detection + self-healing loop</li>
            <li>✓ Policy gates for human approval boundaries</li>
            <li>✓ LLM-agnostic (Copilot, Claude, Codex, Gemini)</li>
            <li className={styles.featureMuted}>~ 1 week setup</li>
          </ul>

          <div className={styles.tiers}>
            <p className={styles.tiersTitle}>Setup tiers</p>
            <div className={styles.tier}>
              <span>Basic pipeline (build + review + merge)</span>
              <span className={styles.tierPrice}>$2K</span>
            </div>
            <div className={styles.tier}>
              <span>Full pipeline (+ CI self-healing)</span>
              <span className={styles.tierPrice}>$3.5K</span>
            </div>
            <div className={styles.tier}>
              <span>Full + meeting-to-main integration</span>
              <span className={styles.tierPrice}>$5K</span>
            </div>
          </div>

          <a href={MAILTO} className={styles.ctaOutline}>Get in touch →</a>
          <p className={styles.subCta}>Optional ongoing support from $200/mo</p>
        </div>
      </div>

      <div className={styles.scope}>
        <p className={styles.scopeTitle}>What's in scope today</p>
        <p className={styles.scopeBody}>
          Web apps (Next.js, Express, Node.js). Best fit for new products and
          isolated builds. No mobile, no desktop, no complex infrastructure.
          We're upfront about boundaries because the pipeline is honest about
          what it can deliver.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd studio && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add studio/components/landing/pricing.tsx studio/components/landing/pricing.module.css
git commit -m "feat: create pricing section with Offer A and Offer B tiers"
```

---

### Task 5: Create "What You Get" component (replacing contrast list)

**Files:**
- Create: `studio/components/landing/what-you-get.tsx`
- Create: `studio/components/landing/what-you-get.module.css`
- Delete: `studio/components/landing/contrast-list.tsx`
- Delete: `studio/components/landing/contrast-list.module.css`

- [ ] **Step 1: Create what-you-get.module.css**

Create `studio/components/landing/what-you-get.module.css`:

```css
.section {
  padding: 80px 48px 0;
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

.heading {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
  max-width: 460px;
}

.subtitle {
  font-size: 15px;
  color: var(--ink-muted);
  margin-bottom: 40px;
  max-width: 520px;
  line-height: 1.5;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  max-width: 720px;
}

.item {
  border-top: 2px solid var(--ink);
  padding-top: 20px;
}

.itemTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 8px;
}

.itemBody {
  font-size: 13px;
  color: var(--ink-muted);
  line-height: 1.5;
}

@media (max-width: 768px) {
  .section {
    padding: 60px 24px 0;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create what-you-get.tsx**

Create `studio/components/landing/what-you-get.tsx`:

```tsx
import styles from "./what-you-get.module.css";

const DELIVERABLES = [
  {
    title: "A real repo",
    body: "Your own GitHub repository with clean commit history, PR-reviewed code, and full version control. Not locked in a platform.",
  },
  {
    title: "CI/CD from day one",
    body: "Every project ships with automated builds, tests, and deployment. Not a prototype you still need to operationalize.",
  },
  {
    title: "It stays healthy",
    body: "CI failures are detected, diagnosed, and fixed through the same pipeline. The system treats its own failures as work items.",
  },
];

export function WhatYouGet() {
  return (
    <section className={styles.section}>
      <span className={styles.label}>What you get</span>
      <h2 className={styles.heading}>Not a prototype. A deployed product.</h2>
      <p className={styles.subtitle}>
        Tools like Bolt and Lovable help you prototype quickly. This gives you
        a deployed app, a real repo, and CI/CD from day one.
      </p>
      <div className={styles.grid}>
        {DELIVERABLES.map((d) => (
          <div key={d.title} className={styles.item}>
            <h3 className={styles.itemTitle}>{d.title}</h3>
            <p className={styles.itemBody}>{d.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit new component only (do NOT delete contrast-list yet — page.tsx still imports it)**

```bash
git add studio/components/landing/what-you-get.tsx studio/components/landing/what-you-get.module.css
git commit -m "feat: create buyer-focused 'What You Get' section"
```

The old `contrast-list.tsx` and `contrast-list.module.css` will be deleted in Task 8 when `page.tsx` is rewired to import `WhatYouGet` instead. This keeps the build green throughout.

---

## Chunk 3: Modified Sections — How It Works + Evidence + Bottom CTA

### Task 6: Rewrite "How It Works" to include pipeline animation

**Files:**
- Modify: `studio/components/landing/how-it-works.tsx`
- Modify: `studio/components/landing/how-it-works.module.css`

- [ ] **Step 1: Rewrite how-it-works.module.css**

Replace the entire contents of `studio/components/landing/how-it-works.module.css` with:

```css
.section {
  padding: 80px 48px 0;
}

.labelRow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.label {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-faint);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.labelGhaw {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--policy);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dot {
  color: var(--ink-faint);
  opacity: 0.5;
  font-size: 11px;
}

.heading {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
  max-width: 520px;
}

.subtitle {
  font-size: 15px;
  color: var(--ink-muted);
  margin-bottom: 40px;
  max-width: 520px;
  line-height: 1.5;
}

.animation {
  margin-bottom: 32px;
  max-width: 720px;
  overflow: hidden;
}

.steps {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  max-width: 720px;
}

.step {
  border-top: 2px solid var(--accent);
  padding: 16px 16px 0 0;
}

.stepPolicy {
  border-top-color: var(--policy);
}

.stepGood {
  border-top-color: var(--good);
}

.stepNum {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.stepNumAccent {
  color: var(--accent);
}

.stepNumPolicy {
  color: var(--policy);
}

.stepNumGood {
  color: var(--good);
}

.stepTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 4px;
}

.stepBody {
  font-size: 12px;
  color: var(--ink-muted);
  line-height: 1.4;
}

.credibility {
  margin-top: 32px;
  padding: 20px;
  background: var(--surface);
  border-radius: 6px;
  max-width: 720px;
}

.credibilityBody {
  font-size: 13px;
  color: var(--ink-muted);
  line-height: 1.6;
}

.credibilityBody strong {
  color: var(--ink-mid);
}

@media (max-width: 768px) {
  .section {
    padding: 60px 24px 0;
  }
  .steps {
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}
```

- [ ] **Step 2: Rewrite how-it-works.tsx**

Replace the entire contents of `studio/components/landing/how-it-works.tsx` with:

```tsx
import { PipelineAnimation } from "./pipeline-animation";
import styles from "./how-it-works.module.css";

const STEPS = [
  { num: "01", title: "Decompose", body: "PRD → scoped GitHub issues with acceptance criteria", color: "accent" },
  { num: "02", title: "Build", body: "Agents implement each issue, open PRs with tests", color: "accent" },
  { num: "03", title: "Review", body: "Automated code review verifies against the original spec", color: "accent" },
  { num: "04", title: "Gate", body: "Policy decides what merges autonomously vs. needs human sign-off", color: "policy" },
  { num: "05", title: "Ship + Heal", body: "Deploy to production. CI failures route back through the pipeline.", color: "good" },
];

const STEP_CLASS: Record<string, string> = {
  policy: styles.stepPolicy,
  good: styles.stepGood,
};

const NUM_CLASS: Record<string, string> = {
  accent: styles.stepNumAccent,
  policy: styles.stepNumPolicy,
  good: styles.stepNumGood,
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.labelRow}>
        <span className={styles.label}>How it works</span>
        <span className={styles.dot}>·</span>
        <span className={styles.labelGhaw}>Powered by GitHub Agentic Workflows</span>
      </div>
      <h2 className={styles.heading}>
        Agents build the app. Policy controls the boundaries.
      </h2>
      <p className={styles.subtitle}>
        Your PRD is decomposed into scoped issues. Specialized agents implement
        each one, open PRs, pass automated review. Human approval gates enforce
        where the boundary is.
      </p>

      <div className={styles.animation}>
        <PipelineAnimation />
      </div>

      <div className={styles.steps}>
        {STEPS.map((step) => (
          <div
            key={step.num}
            className={`${styles.step} ${STEP_CLASS[step.color] || ""}`}
          >
            <p className={`${styles.stepNum} ${NUM_CLASS[step.color] || ""}`}>
              {step.num}
            </p>
            <p className={styles.stepTitle}>{step.title}</p>
            <p className={styles.stepBody}>{step.body}</p>
          </div>
        ))}
      </div>

      <div className={styles.credibility}>
        <p className={styles.credibilityBody}>
          Built on <strong>GitHub Agentic Workflows</strong> — an open framework
          from GitHub for autonomous development workflows. We've filed 31
          upstream findings, with 17 fixes shipped across 7 releases. The
          pipeline is real infrastructure, not a demo.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd studio && npm run build`
Expected: Build succeeds. `page.tsx` still imports `HowItWorks` by name, and `contrast-list.tsx` still exists, so no broken imports.

- [ ] **Step 4: Commit**

```bash
git add studio/components/landing/how-it-works.tsx studio/components/landing/how-it-works.module.css
git commit -m "feat: restructure How It Works with pipeline animation and gh-aw credibility"
```

---

### Task 7: Update evidence ledger and bottom CTA copy

**Files:**
- Modify: `studio/components/landing/evidence-ledger.tsx`
- Modify: `studio/components/landing/evidence-ledger.module.css`
- Modify: `studio/components/landing/bottom-cta.tsx`
- Modify: `studio/components/landing/bottom-cta.module.css`

- [ ] **Step 1: Replace evidence-ledger.tsx**

Replace the entire contents of `studio/components/landing/evidence-ledger.tsx` with:

```tsx
import type { EvidenceRow } from "@/lib/types";
import styles from "./evidence-ledger.module.css";

const OUTCOME_CLASS: Record<string, string> = {
  running: styles.live,
  merged: styles.merged,
  healed: styles.healed,
  blocked: styles.blocked,
  drill: styles.drill,
};

const OUTCOME_LABEL: Record<string, string> = {
  running: "● running",
  merged: "● merged",
  healed: "● healed",
  blocked: "● blocked",
  drill: "○ drill",
};

export function EvidenceLedger({ rows }: { rows: EvidenceRow[] }) {
  const visible = rows.slice(0, 5);

  if (visible.length === 0) {
    return (
      <section id="evidence" className={styles.section}>
        <h2 className={styles.heading}>This site builds itself.</h2>
        <p className={styles.empty}>Recent activity unavailable.</p>
      </section>
    );
  }

  return (
    <section id="evidence" className={styles.section}>
      <h2 className={styles.heading}>This site builds itself.</h2>
      <p className={styles.subtitle}>
        Every feature on this page was implemented, reviewed, and deployed by
        the pipeline — with policy gates deciding what needs human approval.
        Here's the recent activity.
      </p>
      <div className={styles.ledger}>
        <div className={styles.header}>
          <span>Time</span>
          <span>Event</span>
          <span>Duration</span>
          <span>Outcome</span>
        </div>
        {visible.map((row, i) => (
          <div key={i} className={`${styles.row} ${i === 0 ? styles.featured : ""}`}>
            <span className={styles.time}>{row.time}</span>
            <span className={styles.event}>
              {row.event}
              {row.refs.map((ref) => (
                <a
                  key={ref.label}
                  href={ref.url}
                  className={`${styles.ref} ${
                    ref.type === "heal" ? styles.refHeal :
                    ref.type === "policy" ? styles.refPolicy : ""
                  }`}
                  target="_blank"
                  rel="noopener"
                >
                  {ref.label}
                </a>
              ))}
            </span>
            <span className={styles.duration}>{row.duration || "—"}</span>
            <span className={`${styles.outcome} ${OUTCOME_CLASS[row.outcome] || ""}`}>
              {OUTCOME_LABEL[row.outcome] || row.outcome}
            </span>
          </div>
        ))}
        <div className={styles.footer}>
          Showing {visible.length} recent event{visible.length !== 1 ? "s" : ""} ·{" "}
          <a href="https://github.com/samuelkahessay/prd-to-prod" target="_blank" rel="noopener">
            View all on GitHub →
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update evidence-ledger.module.css**

In `studio/components/landing/evidence-ledger.module.css`, delete the `.num` block (the 9-line block starting with `.num {` and ending with `display: block;` + `}`). These lines:

```css
/* DELETE THIS BLOCK */
.num {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-faint);
  margin-bottom: 16px;
  letter-spacing: 0.04em;
  display: block;
}
```

Leave all other classes unchanged.

- [ ] **Step 3: Replace bottom-cta.tsx**

Replace the entire contents of `studio/components/landing/bottom-cta.tsx` with:

```tsx
import styles from "./bottom-cta.module.css";

const MAILTO = "mailto:sam@skahessay.dev?subject=PRD%20Submission";

export function BottomCta() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Ready to ship something?</h2>
      <p className={styles.body}>
        Send us a PRD, a rough brief, or even just an idea. We'll reply with
        scope, timeline, and price. First project free.
      </p>
      <a href={MAILTO} className={styles.ctaPrimary}>Send your PRD →</a>
      <a
        href="https://github.com/samuelkahessay/prd-to-prod"
        className={styles.ctaLink}
        target="_blank"
        rel="noopener"
      >
        View on GitHub →
      </a>
    </section>
  );
}
```

- [ ] **Step 4: Update bottom-cta.module.css**

In `studio/components/landing/bottom-cta.module.css`, change `.ctaLink` to remove `margin-left` (the link is now on a separate line, not inline):

Replace:
```css
.ctaLink {
  display: inline-block;
  margin-left: 20px;
```

With:
```css
.ctaLink {
  display: inline-block;
  margin-top: 12px;
```

- [ ] **Step 5: Verify build**

Run: `cd studio && npm run build`
Expected: Build succeeds. `page.tsx` still imports `ContrastList` but the file still exists (we deferred deletion to Task 8).

- [ ] **Step 6: Commit**

```bash
git add studio/components/landing/evidence-ledger.tsx studio/components/landing/evidence-ledger.module.css studio/components/landing/bottom-cta.tsx studio/components/landing/bottom-cta.module.css
git commit -m "feat: update evidence ledger and bottom CTA with product copy"
```

---

## Chunk 4: Wire Everything Together

### Task 8: Rewire page.tsx with new section order and components

**Files:**
- Modify: `studio/app/page.tsx`
- Modify: `studio/app/page.module.css`

- [ ] **Step 1: Delete old contrast list files**

```bash
git rm studio/components/landing/contrast-list.tsx studio/components/landing/contrast-list.module.css
```

- [ ] **Step 2: Rewrite page.tsx**

Replace the entire contents of `studio/app/page.tsx` with:

```tsx
import { fetchEvidenceData } from "@/lib/github";
import { StickyNav } from "@/components/landing/sticky-nav";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { WhatYouGet } from "@/components/landing/what-you-get";
import { HowItWorks } from "@/components/landing/how-it-works";
import { EvidenceLedger } from "@/components/landing/evidence-ledger";
import { BottomCta } from "@/components/landing/bottom-cta";
import styles from "./page.module.css";

export default async function LandingPage() {
  const evidence = await fetchEvidenceData();

  return (
    <main className={styles.page}>
      <StickyNav />

      <Hero />

      <hr className={styles.divider} />
      <Pricing />

      <hr className={styles.divider} />
      <WhatYouGet />

      <hr className={styles.divider} />
      <HowItWorks />

      <hr className={styles.divider} />
      <EvidenceLedger rows={evidence} />

      <hr className={styles.divider} />
      <BottomCta />
    </main>
  );
}
```

- [ ] **Step 3: Update page.module.css**

Replace the entire contents of `studio/app/page.module.css` with:

```css
.page {
  min-height: 100vh;
}

.divider {
  border: none;
  border-top: 1px solid var(--rule);
  margin: 80px 48px;
}

@media (max-width: 768px) {
  .divider {
    margin: 60px 24px;
  }
}
```

The old `.nav`, `.logo`, `.links` classes are removed — the sticky nav component owns its own styles now.

- [ ] **Step 4: Verify build**

Run: `cd studio && npm run build`
Expected: Build succeeds. All imports resolve, no type errors.

- [ ] **Step 5: Verify dev server renders**

Run: `cd studio && npm run dev`
Open: `http://localhost:3000`
Expected: Page loads with all sections in order. Sticky nav appears on scroll. All CTAs point to mailto link. Pipeline animation renders in How It Works section. Evidence ledger shows live data (or empty state if no GitHub token).

- [ ] **Step 6: Commit**

```bash
git add studio/app/page.tsx studio/app/page.module.css studio/components/landing/contrast-list.tsx studio/components/landing/contrast-list.module.css
git commit -m "feat: rewire landing page with product section order and sticky nav

Removes old contrast-list component (replaced by what-you-get in Task 5)."
```

---

### Task 9: Final verification and cleanup

**Files:**
- Verify all files compile and render correctly

- [ ] **Step 1: Full build check**

Run: `cd studio && npm run build`
Expected: Build succeeds with no errors and no warnings about unused exports.

- [ ] **Step 2: Check for dead imports**

Verify that no file still imports from `contrast-list.tsx` or references the old `ContrastList` component:

```bash
grep -r "contrast-list\|ContrastList" studio/
```

Expected: No results.

- [ ] **Step 3: Check all anchor links**

Start the dev server and manually verify:
- Click "Pricing" in nav → scrolls to #pricing section
- Click "How it works" in nav → scrolls to #how-it-works section
- Click "For Teams" in nav → scrolls to #for-teams (Card B in pricing)
- Click "See pricing" in hero → scrolls to #pricing
- Click any "Send your PRD →" → opens mailto:sam@skahessay.dev

- [ ] **Step 4: Check responsive layout**

Resize browser to mobile width (~375px):
- Pricing cards stack vertically
- What You Get items stack vertically
- Nav shows only logo + CTA button (section links hidden)
- Hero has reduced padding
- Dividers have reduced margin

- [ ] **Step 5: Commit if any fixes were needed**

Stage only the specific files you fixed (do NOT use `git add -A` — unrelated files in the repo root should not be staged). Then commit:

```bash
git commit -m "fix: address issues found during final verification"
```

Only run this step if fixes were applied. Skip if everything passed clean.
