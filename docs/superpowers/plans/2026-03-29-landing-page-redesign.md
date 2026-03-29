# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 10-section self-serve landing page with a focused 5-section conversation-starting page before Aurrin's LinkedIn post goes live Monday morning.

**Architecture:** Modify 3 existing components (sticky-nav, hero, bottom-cta), create 3 new components (pipeline, proof, audience), and simplify page.tsx composition. All existing components are kept on disk but removed from page.tsx imports. No new dependencies.

**Tech Stack:** Next.js 14, CSS Modules, OKLCH design tokens (globals.css)

---

### Task 1: Update StickyNav — simplified links and CTA

**Files:**
- Modify: `web/components/landing/sticky-nav.tsx`

- [ ] **Step 1: Replace nav links and CTA**

Replace the entire contents of `web/components/landing/sticky-nav.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./sticky-nav.module.css";

export function StickyNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 80);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <a href="/" className={styles.logo}>prd to prod</a>
      <div className={styles.right}>
        <div className={styles.links}>
          <a href="#how-it-works" className={styles.link}>How it works</a>
          <a href="/vision" className={styles.link}>Vision</a>
          <a
            href="https://github.com/samuelkahessay/prd-to-prod"
            className={styles.link}
            target="_blank"
            rel="noopener"
          >
            GitHub
          </a>
        </div>
        <a
          href="https://calendly.com/kahessay"
          className={styles.cta}
          target="_blank"
          rel="noopener"
        >
          Book a call
        </a>
        <button
          className={`${styles.menuBtn} ${menuOpen ? styles.menuOpen : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <span className={styles.menuLine} />
          <span className={styles.menuLine} />
        </button>
      </div>
      {menuOpen && (
        <div className={styles.dropdown}>
          <a
            href="https://calendly.com/kahessay"
            className={styles.dropLink}
            target="_blank"
            rel="noopener"
            onClick={() => setMenuOpen(false)}
          >
            Book a call
          </a>
          <a href="#how-it-works" className={styles.dropLink} onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="/vision" className={styles.dropLink} onClick={() => setMenuOpen(false)}>Vision</a>
          <a
            href="https://github.com/samuelkahessay/prd-to-prod"
            className={styles.dropLink}
            target="_blank"
            rel="noopener"
            onClick={() => setMenuOpen(false)}
          >
            GitHub
          </a>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Verify nav renders**

Run: `cd web && npm run dev`

Open `http://localhost:3000`. Verify:
- Nav shows "How it works | Vision | GitHub" links
- CTA button says "Book a call"
- "Book a call" opens Calendly in new tab
- Mobile hamburger menu shows same links
- "How it works" anchor link is present (target section will come in Task 4)

- [ ] **Step 3: Commit**

```bash
git add web/components/landing/sticky-nav.tsx
git commit -m "style: simplify nav to How it works | Vision | GitHub + Book a call CTA"
```

---

### Task 2: Update Hero — new headline, subtitle, CTAs, no stats grid or media

**Files:**
- Modify: `web/components/landing/hero.tsx`
- Modify: `web/components/landing/hero.module.css`

- [ ] **Step 1: Replace hero component**

Replace the entire contents of `web/components/landing/hero.tsx` with:

```tsx
import styles from "./hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Autonomous delivery infrastructure</p>
      <h1 className={styles.headline}>
        Code generation is solved.<br />
        Delivery isn&apos;t.
      </h1>
      <p className={styles.subtitle}>
        AI agents can write code — but shipping software requires spec
        decomposition, independent review, deployment, CI repair, and audit
        trails. We build the orchestration layer that governs the full pipeline.
      </p>
      <div className={styles.actions}>
        <a
          href="https://calendly.com/kahessay"
          className={styles.ctaPrimary}
          target="_blank"
          rel="noopener"
        >
          Book a call
        </a>
        <a href="/vision" className={styles.ctaSecondary}>
          Read the full thesis →
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace hero styles**

Replace the entire contents of `web/components/landing/hero.module.css` with:

```css
.hero {
  padding: 140px 48px 60px;
  max-width: 720px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
  margin-bottom: 16px;
}

.headline {
  font-size: clamp(36px, 5vw, 52px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 20px;
}

.subtitle {
  font-size: 17px;
  font-weight: 400;
  color: var(--ink-mid);
  max-width: 580px;
  line-height: 1.65;
  margin-bottom: 32px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.ctaPrimary {
  display: inline-block;
  background: var(--ink);
  color: var(--cream);
  padding: 12px 24px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  text-decoration: none;
  border-radius: 6px;
}

.ctaSecondary {
  font-size: 14px;
  color: var(--ink-mid);
  text-decoration: none;
  border-bottom: 1px solid var(--rule);
  padding-bottom: 2px;
}

.ctaSecondary:hover {
  color: var(--ink);
}

@media (max-width: 768px) {
  .hero {
    padding: 110px 24px 48px;
  }

  .headline {
    font-size: clamp(28px, 7vw, 42px);
  }
}
```

- [ ] **Step 3: Verify hero renders**

Run the dev server (if not already running). Verify:
- Eyebrow says "Autonomous delivery infrastructure"
- Headline says "Code generation is solved. Delivery isn't."
- Subtitle is the full pipeline description
- "Book a call" button links to Calendly
- "Read the full thesis →" links to /vision
- No stats grid, no media images, no waitlist form
- Responsive: headline shrinks on mobile

- [ ] **Step 4: Commit**

```bash
git add web/components/landing/hero.tsx web/components/landing/hero.module.css
git commit -m "style: redesign hero with new headline, subtitle, and Calendly CTA"
```

---

### Task 3: Create Pipeline component (Section 2)

**Files:**
- Create: `web/components/landing/pipeline.tsx`
- Create: `web/components/landing/pipeline.module.css`

- [ ] **Step 1: Create the pipeline component**

Create `web/components/landing/pipeline.tsx`:

```tsx
import styles from "./pipeline.module.css";

const STEPS = [
  {
    num: "01",
    title: "Brief intake",
    body: "File a product brief as a GitHub issue. Plain language, rough scope — the pipeline structures it.",
  },
  {
    num: "02",
    title: "Decompose into tasks",
    body: "Planner agent breaks the brief into parallel issues with dependency ordering.",
  },
  {
    num: "03",
    title: "Agents implement",
    body: "Builder agents open PRs, react to CI checks, and keep the repo moving.",
  },
  {
    num: "04",
    title: "Independent review",
    body: "A separate reviewer agent inspects every PR. Identity separation — builder ≠ approver.",
  },
  {
    num: "05",
    title: "Deploy and self-heal",
    body: "Merge, deploy, and if CI breaks, agents detect, diagnose, and repair autonomously.",
  },
];

export function Pipeline() {
  return (
    <section id="how-it-works" className={styles.section}>
      <h2 className={styles.heading}>The pipeline</h2>
      <p className={styles.subheading}>
        A product brief goes in. A deployed, governed repo comes out.
      </p>
      <div className={styles.steps}>
        {STEPS.map((step) => (
          <div key={step.num} className={styles.step}>
            <span className={styles.num}>{step.num}</span>
            <div>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.body}>{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create pipeline styles**

Create `web/components/landing/pipeline.module.css`:

```css
.section {
  padding: 80px 48px 0;
  max-width: 720px;
}

.heading {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.subheading {
  font-size: 15px;
  color: var(--ink-mid);
  margin-bottom: 32px;
}

.steps {
  display: flex;
  flex-direction: column;
}

.step {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 16px;
  padding: 20px 0;
  border-bottom: 1px solid var(--rule);
}

.step:last-child {
  border-bottom: none;
}

.num {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-muted);
  padding-top: 2px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.body {
  font-size: 14px;
  color: var(--ink-mid);
  line-height: 1.5;
}

@media (max-width: 768px) {
  .section {
    padding: 60px 24px 0;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/landing/pipeline.tsx web/components/landing/pipeline.module.css
git commit -m "feat: add Pipeline component for 5-step pipeline section"
```

---

### Task 4: Create Proof component (Section 3)

**Files:**
- Create: `web/components/landing/proof.tsx`
- Create: `web/components/landing/proof.module.css`

- [ ] **Step 1: Create the proof component**

Create `web/components/landing/proof.tsx`:

```tsx
import styles from "./proof.module.css";

const METRICS = [
  { value: "80", label: "PRs merged" },
  { value: "133", label: "issues" },
  { value: "12", label: "modules" },
  { value: "6", label: "days" },
];

export function Proof() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Built with the pipeline</h2>

      <div className={styles.caseStudy}>
        <p className={styles.caseLabel}>First client build</p>
        <h3 className={styles.caseTitle}>Aurrin Ventures Crowdfunding Platform</h3>
        <p className={styles.caseBody}>
          Calgary accelerator replacing their static site with a 12-module
          platform for founders to build in public and raise money. From idea to
          working product in 6 days — 80 agent-merged PRs across 133 issues.
        </p>
        <div className={styles.metrics}>
          {METRICS.map((m) => (
            <div key={m.label} className={styles.metric}>
              <strong>{m.value}</strong> <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className={styles.credibility}>
        <li>
          <strong>Top 3 contributor</strong> to GitHub Agentic Workflows — 28
          issues filed, 15 credited by name across 8 releases
        </li>
        <li>
          <strong>Open source, MIT licensed</strong> — full pipeline source code.
          You own the repo, the pipeline, and the governance layer.
        </li>
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Create proof styles**

Create `web/components/landing/proof.module.css`:

```css
.section {
  padding: 80px 48px 0;
  max-width: 720px;
}

.heading {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 24px;
}

/* ─── Case Study Card ─── */

.caseStudy {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 32px;
  margin-bottom: 32px;
}

.caseLabel {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--good);
  margin-bottom: 12px;
}

.caseTitle {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.caseBody {
  font-size: 15px;
  color: var(--ink-mid);
  line-height: 1.6;
  margin-bottom: 20px;
}

.metrics {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.metric {
  font-family: var(--font-mono);
  font-size: 13px;
}

.metric strong {
  color: var(--ink);
}

.metric span {
  color: var(--ink-muted);
}

/* ─── Credibility Bullets ─── */

.credibility {
  list-style: none;
  padding: 0;
}

.credibility li {
  font-size: 14px;
  color: var(--ink-mid);
  padding: 12px 0;
  border-bottom: 1px solid var(--rule);
  line-height: 1.5;
}

.credibility li:last-child {
  border-bottom: none;
}

.credibility strong {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 13px;
}

@media (max-width: 768px) {
  .section {
    padding: 60px 24px 0;
  }

  .caseStudy {
    padding: 24px;
  }

  .metrics {
    gap: 16px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/landing/proof.tsx web/components/landing/proof.module.css
git commit -m "feat: add Proof component with Aurrin case study and credibility bullets"
```

---

### Task 5: Create Audience component (Section 4)

**Files:**
- Create: `web/components/landing/audience.tsx`
- Create: `web/components/landing/audience.module.css`

- [ ] **Step 1: Create the audience component**

Create `web/components/landing/audience.tsx`:

```tsx
import styles from "./audience.module.css";

export function Audience() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Who this is for</h2>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Founders with ideas</h3>
          <p className={styles.cardBody}>
            You have a product brief or a clear idea. You need it built and
            deployed — not a prototype, a real repo with CI, review, and a deploy
            pipeline you own.
          </p>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Teams starting new projects</h3>
          <p className={styles.cardBody}>
            You have engineers but want to start agent-first. We install the
            pipeline in your repo, run a proof-of-concept, and hand off the
            governance layer.
          </p>
        </div>
      </div>

      <div className={styles.convergence}>
        <p>
          <strong>Where the industry is heading:</strong> GitHub shipped Agentic
          Workflows. Vercel added Mitchell Hashimoto to the board. Factory raised
          $70M from Sequoia. The infrastructure layer for autonomous delivery is
          being built right now — and we&apos;re one of the deepest
          implementations running in production.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create audience styles**

Create `web/components/landing/audience.module.css`:

```css
.section {
  padding: 80px 48px 0;
  max-width: 720px;
}

.heading {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 24px;
}

/* ─── Audience Cards ─── */

.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 24px;
}

.cardTitle {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.cardBody {
  font-size: 14px;
  color: var(--ink-mid);
  line-height: 1.5;
}

/* ─── Convergence Callout ─── */

.convergence {
  margin-top: 24px;
  padding: 16px 20px;
  background: var(--surface);
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
}

.convergence p {
  font-size: 14px;
  color: var(--ink-mid);
  line-height: 1.6;
}

.convergence strong {
  color: var(--ink);
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

- [ ] **Step 3: Commit**

```bash
git add web/components/landing/audience.tsx web/components/landing/audience.module.css
git commit -m "feat: add Audience component with founder/team cards and convergence callout"
```

---

### Task 6: Update BottomCta — Calendly, email, footer links

**Files:**
- Modify: `web/components/landing/bottom-cta.tsx`
- Modify: `web/components/landing/bottom-cta.module.css`

- [ ] **Step 1: Replace bottom CTA component**

Replace the entire contents of `web/components/landing/bottom-cta.tsx` with:

```tsx
import styles from "./bottom-cta.module.css";

export function BottomCta() {
  return (
    <footer className={styles.section}>
      <h2 className={styles.heading}>Let&apos;s talk about your project.</h2>
      <p className={styles.body}>
        15 minutes. Tell me what you&apos;re building, I&apos;ll tell you if the
        pipeline is a fit.
      </p>
      <a
        href="https://calendly.com/kahessay"
        className={styles.ctaPrimary}
        target="_blank"
        rel="noopener"
      >
        Book a call
      </a>
      <p className={styles.email}>or email kahessay@icloud.com</p>
      <div className={styles.links}>
        <a href="/pitch">Full pitch deck →</a>
        <a href="/vision">Technical vision →</a>
        <a
          href="https://github.com/samuelkahessay/prd-to-prod"
          target="_blank"
          rel="noopener"
        >
          GitHub →
        </a>
        <a
          href="https://linkedin.com/in/samuelkahessay"
          target="_blank"
          rel="noopener"
        >
          LinkedIn →
        </a>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Replace bottom CTA styles**

Replace the entire contents of `web/components/landing/bottom-cta.module.css` with:

```css
.section {
  padding: 80px 48px 80px;
  max-width: 720px;
  text-align: center;
}

.heading {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
}

.body {
  font-size: 15px;
  color: var(--ink-mid);
  margin-bottom: 28px;
  max-width: 440px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

.ctaPrimary {
  display: inline-block;
  background: var(--ink);
  color: var(--cream);
  padding: 14px 32px;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  text-decoration: none;
  border-radius: 6px;
}

.email {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ink-muted);
  margin-top: 12px;
}

.links {
  margin-top: 24px;
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
  font-size: 13px;
}

.links a {
  color: var(--ink-muted);
  text-decoration: none;
  border-bottom: 1px solid var(--rule);
  padding-bottom: 1px;
}

.links a:hover {
  color: var(--ink);
}

@media (max-width: 640px) {
  .section {
    padding: 60px 24px 60px;
  }

  .links {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/landing/bottom-cta.tsx web/components/landing/bottom-cta.module.css
git commit -m "style: redesign bottom CTA with Calendly, email, and footer links"
```

---

### Task 7: Wire up page.tsx — new section composition

**Files:**
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Replace page composition**

Replace the entire contents of `web/app/page.tsx` with:

```tsx
import { StickyNav } from "@/components/landing/sticky-nav";
import { SplashIntro } from "@/components/landing/splash-intro";
import { Hero } from "@/components/landing/hero";
import { Pipeline } from "@/components/landing/pipeline";
import { Proof } from "@/components/landing/proof";
import { Audience } from "@/components/landing/audience";
import { BottomCta } from "@/components/landing/bottom-cta";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <div className={styles.shell}>
      <SplashIntro />
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <Hero />

        <hr className={styles.divider} />
        <Pipeline />

        <hr className={styles.divider} />
        <Proof />

        <hr className={styles.divider} />
        <Audience />

        <hr className={styles.divider} />
      </main>

      <BottomCta />
    </div>
  );
}
```

Note: this removes the `async` keyword and `fetchEvidenceData()` call since the evidence ledger is no longer rendered.

- [ ] **Step 2: Verify the full page**

Run: `cd web && npm run dev`

Open `http://localhost:3000`. Walk through the entire page and verify:

1. Splash animation plays on first visit, then not again
2. Nav: "How it works | Vision | GitHub" + "Book a call" button
3. Hero: new headline, subtitle, two CTAs (no stats grid, no media images)
4. Pipeline: 5 numbered steps with titles and descriptions
5. Proof: Aurrin case study card with metrics + 2 credibility bullets
6. Audience: two side-by-side cards + convergence callout
7. CTA: "Let's talk about your project" + Book a call + email + footer links
8. "How it works" nav link scrolls to pipeline section
9. Mobile: hamburger menu works, cards stack, headline resizes
10. No console errors, no broken images, no 404s

- [ ] **Step 3: Verify build passes**

Run: `cd web && npm run build`

Expected: Build succeeds with no errors. The removed components are still on disk but not imported, so they won't cause issues.

- [ ] **Step 4: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat: redesign landing page — 5 focused sections, Calendly CTA, Aurrin case study"
```

---

### Task 8: Final verification and deploy

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

```bash
cd web && npm run build
```

Expected: Clean build, no errors, no warnings about missing imports.

- [ ] **Step 2: Test all internal links**

Start dev server and verify each link:
- Nav "How it works" → scrolls to `#how-it-works`
- Nav "Vision" → loads `/vision`
- Nav "GitHub" → opens GitHub repo in new tab
- Nav "Book a call" → opens Calendly in new tab
- Hero "Book a call" → opens Calendly in new tab
- Hero "Read the full thesis →" → loads `/vision`
- Bottom "Book a call" → opens Calendly in new tab
- Bottom "Full pitch deck →" → loads `/pitch`
- Bottom "Technical vision →" → loads `/vision`
- Bottom "GitHub →" → opens GitHub repo in new tab
- Bottom "LinkedIn →" → opens LinkedIn in new tab

- [ ] **Step 3: Test preserved routes**

Verify these still work:
- `/demo` → demo page loads
- `/build` → build page loads
- `/pitch` → pitch page loads
- `/vision` → vision page loads

- [ ] **Step 4: Test mobile responsiveness**

Open Chrome DevTools, toggle device toolbar, test at 375px width:
- Hamburger menu opens and closes
- Hero headline resizes
- Pipeline steps are readable
- Audience cards stack vertically
- Footer links stack vertically
- All CTAs are tappable (min 44px touch target)

- [ ] **Step 5: Push and deploy**

```bash
git push origin main
```

Vercel auto-deploys on push to main. Verify at https://prdtoprod.com once deploy completes.
