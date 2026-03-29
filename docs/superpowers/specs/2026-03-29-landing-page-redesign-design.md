# Landing Page Redesign — Design Spec

**Date:** 2026-03-29
**Trigger:** Aurrin Ventures LinkedIn endorsement (Monday 3/31) + Platform Calgary x White Star Capital investor office hours (Tuesday 4/1)
**Goal:** Refocus prdtoprod.com from a self-serve product page to a conversation-starting landing page that serves two audiences: Calgary founders (via Aurrin's post) and seed investors (via White Star event).

---

## Context

The current landing page has 10 sections, $1/run self-serve pricing, factory floor animation, showcase strip, evidence ledger, and dual demo/build CTAs. None of this matches the current business stage (zero paying customers, first client case study just landed).

The Minimalist Entrepreneur framework says: strip to what earns conversations. The page's job is to be the link you drop after someone says "tell me more" — not a conversion funnel for cold traffic.

Three existing pages have the right content scattered across them:
- **/vision** has the best headline ("Code Generation Is Solved. Delivery Isn't.")
- **/pitch** has the traction story (Aurrin, 80 PRs, 6 days) and stats
- **Current landing** has the design system, splash animation, and component infrastructure

This redesign remixes those sources into 5 focused sections.

---

## What Changes

### Removed from landing page
- Stats grid in hero (numbers without context)
- $1/run pricing section
- Showcase strip (5 self-generated demo apps)
- Evidence ledger (GitHub activity feed)
- "What You Get" section
- "Watch demo" and "Run your PRD" CTAs
- Waitlist form
- Factory floor / isometric animation references

### Preserved
- Splash intro animation (session-gated, ~2s, plays once)
- Design system (CSS Modules, OKLCH cream/ink palette, DM Sans + JetBrains Mono, 80px section rhythm)
- /demo and /build routes (stay live, just not linked from landing page nav)
- /pitch and /vision pages (unchanged)

### New
- Aurrin case study block (dedicated section with metrics)
- "Book a call" CTA linking to Calendly
- Simplified nav
- Industry convergence callout
- Open source credibility bullet

---

## Navigation

```
Logo: "prd to prod" (links to /)
Links: How it works | Vision | GitHub
CTA button: Book a call
```

**Removed:** "Run your PRD", "Pricing", "Watch demo"
**Added:** "Vision" (links to /vision)
**Changed:** CTA from "Watch demo" to "Book a call" (links to https://calendly.com/kahessay)

**Link targets:**
- "How it works" → scrolls to `#how-it-works` (Section 2)
- "Vision" → /vision
- "GitHub" → https://github.com/samuelkahessay/prd-to-prod (or current repo URL)
- "Book a call" → https://calendly.com/kahessay

Mobile hamburger menu stays, with the same simplified links.

---

## Section 1 — Hero

**Eyebrow:** `Autonomous delivery infrastructure` (mono, uppercase, muted)

**Headline:** `Code generation is solved. Delivery isn't.`
- Source: /vision page headline
- Font: 42px, 700 weight, -0.5px letter-spacing (matches current hero sizing)

**Subtitle:** `AI agents can write code — but shipping software requires spec decomposition, independent review, deployment, CI repair, and audit trails. We build the orchestration layer that governs the full pipeline.`
- Source: /pitch page subtitle
- Font: 17px, ink-mid color, max-width 580px

**CTAs:**
- Primary: "Book a call" → https://calendly.com/kahessay (dark button, mono uppercase)
- Secondary: "Read the full thesis →" → /vision (text link with underline)

**No stats grid.** Numbers belong in the Aurrin case study where they have context.

**Animation:** The splash intro plays before the hero loads (unchanged behavior). No additional animation on the hero itself. Per design principles: "One animation, one identity."

---

## Section 2 — What We Do ("The pipeline")

**Anchor:** `id="how-it-works"` (target of nav link)

**Heading:** `The pipeline`
**Subheading:** `A product brief goes in. A deployed, governed repo comes out.`

**5 steps**, each as a numbered row (01-05) with title + one-line description:

| # | Title | Description |
|---|-------|-------------|
| 01 | Brief intake | File a product brief as a GitHub issue. Plain language, rough scope — the pipeline structures it. |
| 02 | Decompose into tasks | Planner agent breaks the brief into parallel issues with dependency ordering. |
| 03 | Agents implement | Builder agents open PRs, react to CI checks, and keep the repo moving. |
| 04 | Independent review | A separate reviewer agent inspects every PR. Identity separation — builder ≠ approver. |
| 05 | Deploy and self-heal | Merge, deploy, and if CI breaks, agents detect, diagnose, and repair autonomously. |

**Layout:** Vertical list, each step separated by a light rule. Step number in mono on the left, title + description on the right.

**Source:** Simplified from current "How it works" section + /pitch "Solution" section. Human boundary details (what humans vs agents own) stay on /vision — too granular for landing page.

---

## Section 3 — Proof ("Built with the pipeline")

**Heading:** `Built with the pipeline`

### Aurrin Case Study Block

Styled as a card (surface background, border, rounded corners):

- **Label:** `First client build` (mono, uppercase, green/good color)
- **Title:** `Aurrin Ventures Crowdfunding Platform`
- **Description:** `Calgary accelerator replacing their static site with a 12-module platform for founders to build in public and raise money. From idea to working product in 6 days — 80 agent-merged PRs across 133 issues.`
- **Metrics row:** `80 PRs merged` · `133 issues` · `12 modules` · `6 days`
- **Link:** Once Aurrin's LinkedIn post is live (Monday), add a link: "Read Aurrin's announcement →"

This is the most important section on the page. It's the only real client case study and the direct proof of the hero's claim.

### Credibility Bullets

Two items in a simple list below the case study card:

1. **Top 3 contributor** to GitHub Agentic Workflows — 28 issues filed, 15 credited by name across 8 releases
2. **Open source, MIT licensed** — full pipeline source code. You own the repo, the pipeline, and the governance layer.

**Not included:** Name-drops of individuals who amplified blog posts (no permission for commercial use). Self-published blog posts framed as "research" (not credible). Self-healing drill stats (redundant with Section 2, step 5).

---

## Section 4 — Who It's For

**Heading:** `Who this is for`

### Two audience cards (side-by-side grid, responsive to stacked on mobile):

**Card 1: Founders with ideas**
> You have a product brief or a clear idea. You need it built and deployed — not a prototype, a real repo with CI, review, and a deploy pipeline you own.

**Card 2: Teams starting new projects**
> You have engineers but want to start agent-first. We install the pipeline in your repo, run a proof-of-concept, and hand off the governance layer.

Maps to the two offers from the business strategy: "Build it agent-first" (founders, $750-$5K) and "Agent-first setup for your team" (teams, $3K-$7.5K). Prices are NOT on the landing page — they're for the Calendly conversation.

### Industry Convergence Callout

Styled as a left-bordered callout (accent blue border):

> **Where the industry is heading:** GitHub shipped Agentic Workflows. Vercel added Mitchell Hashimoto to the board. Factory raised $70M from Sequoia. The infrastructure layer for autonomous delivery is being built right now — and we're one of the deepest implementations running in production.

This gives investors the "real market" signal without a competitive landscape slide. Founders can skip it — it's supplementary context.

---

## Section 5 — CTA ("Let's talk about your project.")

**Heading:** `Let's talk about your project.`
**Subtitle:** `15 minutes. Tell me what you're building, I'll tell you if the pipeline is a fit.`

**Primary CTA:** "Book a call" → https://calendly.com/kahessay (large dark button)

**Email fallback:** `or email kahessay@icloud.com` (mono, muted, below button)

**Footer links** (small, muted, centered):
- Full pitch deck → /pitch
- Technical vision → /vision
- GitHub → repo link
- LinkedIn → linkedin.com/in/samuelkahessay

---

## Technical Implementation Notes

### Files to modify
- `web/app/page.tsx` — replace section composition (SplashIntro stays, swap remaining sections)
- `web/components/landing/hero.tsx` + `.module.css` — new hero without stats grid
- `web/components/landing/sticky-nav.tsx` + `.module.css` — simplified nav links and CTA
- `web/components/landing/bottom-cta.tsx` + `.module.css` — new CTA with Calendly + email

### Files to create
- `web/components/landing/pipeline.tsx` + `.module.css` — Section 2 (the 5-step pipeline)
- `web/components/landing/proof.tsx` + `.module.css` — Section 3 (Aurrin case study + credibility)
- `web/components/landing/audience.tsx` + `.module.css` — Section 4 (two cards + convergence)

### Files to leave (not deleted, just not imported in page.tsx)
- `web/components/landing/pricing.tsx` — keep for potential future use
- `web/components/landing/what-you-get.tsx` — keep
- `web/components/landing/showcase-strip.tsx` — keep
- `web/components/landing/how-it-works.tsx` — keep (some content reused in pipeline.tsx)
- `web/components/landing/credibility.tsx` — keep
- `web/components/landing/evidence-ledger.tsx` — keep
- `web/components/landing/waitlist-form.tsx` — keep

### Styling approach
- Continue using CSS Modules (no framework change)
- Use existing design tokens from globals.css (--cream, --ink, --surface, --rule, etc.)
- Follow existing patterns: 80px section padding, 720px max-width, 768px breakpoint
- No new animations — splash intro is the only motion on the page

### Routes unchanged
- `/demo` and `/build` stay live and functional
- `/pitch` and `/vision` stay as-is
- Only the landing page (`/`) changes
