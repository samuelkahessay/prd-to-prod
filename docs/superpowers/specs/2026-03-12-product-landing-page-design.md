# Product Landing Page Redesign

> Redesign the prd-to-prod landing page from a technical showcase into a product page that sells two service offerings, led by Offer A ("Send a PRD, get a deployed app").

---

## Context

The current landing page at prd-to-prod.vercel.app reads as an OSS project demo. It describes the pipeline mechanism (agents, policy gates, self-healing) but doesn't frame prd-to-prod as a service someone can buy. There is no pricing, no conversion flow, and no buyer-facing value proposition.

Internal strategy docs define two concrete offerings:
- **Offer A:** Done-for-you app delivery from a PRD ($500–$2K per project)
- **Offer B:** Autonomous pipeline setup on a client's repo ($2K–$5K one-time)

The landing page needs to sell Offer A as the primary conversion path, position Offer B as a secondary upsell for engineering teams, and keep the pipeline/gh-aw story visible as credibility — not the headline.

**Target audience:** Engineering leaders, CTOs, agencies, and solo founders evaluating whether to hand off a project spec and get a deployed app back.

**Secondary audience:** GitHub/Microsoft insiders (Peli de Halleux, Matthew Isabel, Daniel Meppiel) who need to see gh-aw showcased credibly. They should be able to link directly to the "How it works" section.

---

## Architecture: Approach B — Product Page with Anchored Nav

Single-page layout with a sticky navigation bar that lets visitors jump between sections. Same codebase structure (Next.js app in `web/`, CSS modules, server components with `fetchEvidenceData()`).

### Page Structure (top to bottom)

| # | Section | Anchor | Purpose |
|---|---------|--------|---------|
| — | Sticky Nav | — | Always visible. Links to #pricing, #how-it-works, #for-teams, GitHub. "Send your PRD →" CTA button. |
| 1 | Hero | (top) | The promise + primary CTA |
| 2 | Pricing | #pricing | Offer A primary, Offer B secondary |
| 3 | What You Get | — | Buyer-facing deliverables (repo, CI/CD, self-healing) |
| 4 | How It Works | #how-it-works | Pipeline story + gh-aw showcase + animation |
| 5 | Evidence | #evidence | Live GitHub activity ledger |
| 6 | Bottom CTA | — | Repeat the offer, close the loop |

---

## Section 1: Sticky Nav

Replaces the current static nav.

- **Position:** Fixed to top on scroll, transparent until user scrolls past hero, then solid with backdrop blur
- **Left:** `prd-to-prod` wordmark
- **Center/Right links:** Pricing · How it works · For Teams · GitHub
- **Right CTA:** `Send your PRD →` button (dark background, always visible)
- **Style:** `backdrop-filter: blur(8px)`, semi-transparent background (`rgba(247,244,240,0.95)`), 1px bottom border
- **Behavior:** Anchor links smooth-scroll to sections. "For Teams" scrolls to an `id="for-teams"` wrapper around Card B within the pricing section.

### Component changes
- **Modify:** `web/app/page.tsx` — replace current `<nav>` with new sticky nav component
- **New component:** `web/components/landing/sticky-nav.tsx` + `.module.css` (client component for scroll detection)

---

## Section 2: Hero

Replaces the current hero. The pipeline animation moves out.

### Copy

- **Eyebrow:** `Powered by GitHub Agentic Workflows` (monospace, uppercase, muted)
- **Headline:** `Send a PRD.` (weight 900) / `Get a deployed app.` (weight 300, italic, muted — on second line)
- **Subtitle:** `Autonomous agents build, review, and deploy your app from your PRD. You get a live URL, a real repo with CI/CD, and code you own. First project free.`
- **Primary CTA:** `Send your PRD →` (dark button)
- **Secondary CTA:** `See pricing` (underlined text link, anchors to #pricing)

### Layout
- Single column, left-aligned, max-width ~560px for the text block
- No animation or visual element in the hero — the animation moves to Section 4
- Generous vertical padding (80px top, 60px bottom)

### Component changes
- **Modify:** `web/components/landing/hero.tsx` + `hero.module.css` — remove `<PipelineAnimation />` import, rewrite copy and CTAs
- The `PipelineAnimation` component is not deleted — it moves to Section 4

---

## Section 3: Pricing

New section. Does not exist on the current page.

### Structure
Two-column card layout:

**Card A (primary):**
- Visual weight: 2px dark border, "Most popular" badge
- Label: `Send a PRD`
- Price: `$500–$2K` per project
- Feature list:
  - Deployed app on Vercel with live URL
  - Real GitHub repo you own
  - CI/CD pipeline included
  - Production-grade code — reviewed, tested, merged
  - Self-healing CI — failures get fixed automatically
  - ~24–48 hour turnaround (muted)
- Complexity tiers (inline):
  - Simple app / internal tool → $500
  - Multi-feature with integrations → $1K–$1.5K
  - Complex (auth, multiple APIs) → $2K
- CTA: `Send your PRD →` (dark button, matches hero)
- Sub-CTA: `First project free — no card required`

**Card B (secondary):**
- Visual weight: 1px light border, no badge
- Label: `For engineering teams`
- Price: `$2K–$5K` one-time setup
- Feature list:
  - Autonomous pipeline on your repo
  - Issues → agents → PRs → review → merge
  - CI failure detection + self-healing loop
  - Policy gates for human approval boundaries
  - LLM-agnostic (Copilot, Claude, Codex, Gemini)
  - ~1 week setup (muted)
- Setup tiers (inline):
  - Basic pipeline (build + review + merge) → $2K
  - Full pipeline (+ CI self-healing) → $3.5K
  - Full + meeting-to-main integration → $5K
- CTA: `Get in touch →` (outline button)
- Sub-CTA: `Optional ongoing support from $200/mo`

**Scope box** (below both cards):
- Muted background, small text
- Content: `Web apps (Next.js, Express, Node.js). Best fit for new products and isolated builds. No mobile, no desktop, no complex infrastructure. We're upfront about boundaries because the pipeline is honest about what it can deliver.`

### Heading
- Section label: `Pricing` (monospace, uppercase, muted)
- Heading: `Pricing` (clean, one word — matches the minimal voice of the rest of the page)

### Component changes
- **New component:** `web/components/landing/pricing.tsx` + `pricing.module.css`

---

## Section 4: What You Get

Replaces the current contrast list. Same differentiation job, reframed around buyer outcomes.

### Copy
- Section label: `What you get`
- Heading: `Not a prototype. A deployed product.`
- Subtitle: `Tools like Bolt and Lovable help you prototype quickly. This gives you a deployed app, a real repo, and CI/CD from day one.`

### Layout
Three-column grid, each with a top border accent:

1. **A real repo** — Your own GitHub repository with clean commit history, PR-reviewed code, and full version control. Not locked in a platform.
2. **CI/CD from day one** — Every project ships with automated builds, tests, and deployment. Not a prototype you still need to operationalize.
3. **It stays healthy** — CI failures are detected, diagnosed, and fixed through the same pipeline. The system treats its own failures as work items.

### Component changes
- **Modify:** `web/components/landing/contrast-list.tsx` → rename to `what-you-get.tsx` + `what-you-get.module.css` (or replace in-place)
- Update import in `page.tsx`

---

## Section 5: How It Works

Replaces the current "How It Works" section. Absorbs the pipeline animation from the hero.

### Copy
- Section label: `How it works` · `Powered by GitHub Agentic Workflows` (in purple, on same line)
- Heading: `Agents build the app. Policy controls the boundaries.`
- Subtitle: `Your PRD is decomposed into scoped issues. Specialized agents implement each one, open PRs, pass automated review. Human approval gates enforce where the boundary is.`

### Layout

1. **Pipeline animation** — the existing `PipelineAnimation` canvas component, moved here from the hero. Full-width within the section, same 5-act loop (Brief → Plan → Build → Ship → Heal).

2. **5-step strip** below the animation — numbered, color-coded:
   - 01 Decompose (accent blue) — PRD → scoped GitHub issues with acceptance criteria
   - 02 Build (accent blue) — Agents implement each issue, open PRs with tests
   - 03 Review (accent blue) — Automated code review verifies against the original spec
   - 04 Gate (purple) — Policy decides what merges autonomously vs. needs human sign-off
   - 05 Ship + Heal (green) — Deploy to production. CI failures route back through the pipeline.

3. **Upstream credibility box** — muted background:
   `Built on GitHub Agentic Workflows — an open framework from GitHub for autonomous development workflows. We've filed 31 upstream findings, with 17 fixes shipped across 7 releases. The pipeline is real infrastructure, not a demo.`

### Component changes
- **Modify:** `web/components/landing/how-it-works.tsx` + `how-it-works.module.css` — restructure to include `PipelineAnimation`, new 5-step strip, credibility box
- The `PipelineAnimation` component (`pipeline-animation.tsx`) is reused as-is, just rendered in a different parent

---

## Section 6: Evidence Ledger

Kept from the current site. Same data source, reframed copy.

### Copy changes
- Heading: `This site builds itself.` (was "Inspect the work.")
- Subtitle: `Every feature on this page was implemented, reviewed, and deployed by the pipeline — with policy gates deciding what needs human approval. Here's the recent activity.`

The subtitle addition ("with policy gates deciding what needs human approval") addresses the concern that "builds itself" might sound like unsupervised magic. It signals governed autonomy.

### Layout
- Same ledger table structure (Time / Event / Duration / Outcome)
- Compact: show 5 rows max (`.slice(0, 5)` in the component, regardless of how many `fetchEvidenceData()` returns)
- Footer: `Showing N events · View all on GitHub →`

### Component changes
- **Modify:** `web/components/landing/evidence-ledger.tsx` + `evidence-ledger.module.css` — update heading and subtitle text only. Structure unchanged.

---

## Section 7: Bottom CTA

Replaces the current bottom CTA. Closes the loop with the offer.

### Copy
- Heading: `Ready to ship something?`
- Body: `Send us a PRD, a rough brief, or even just an idea. We'll reply with scope, timeline, and price. First project free.`
- Primary CTA: `Send your PRD →`
- Secondary: `View on GitHub` (text link)

### Component changes
- **Modify:** `web/components/landing/bottom-cta.tsx` + `bottom-cta.module.css` — rewrite copy and CTA targets

---

## Conversion Flow: "Send your PRD"

All "Send your PRD →" CTAs open a `mailto:` link (or link to a simple contact mechanism). The specific destination is left flexible — could be:
- `mailto:sam@skahessay.dev?subject=PRD%20Submission` with a pre-filled subject line
- A link to a DM channel
- A simple form (future iteration)

For now, all CTAs point to the same destination. The page does not need a built-in form or intake system at this stage. The goal is learning and conversation, not automation.

---

## Visual Design

### Preserved from current site
- Color palette: warm cream background (`--cream`), dark ink (`--ink`), accent blue, heal orange, policy purple, good green
- Typography: DM Sans (body) + JetBrains Mono (labels, data)
- Design language: editorial, minimal, warm — not SaaS template aesthetic

### Changed
- **Sticky nav** with backdrop blur (new)
- **Pricing cards** — new visual element, uses existing color tokens
- **Hero** — simpler, text-only (no animation)
- **Pipeline animation** — moved, not removed
- **Section numbering** (01, 02, 03) — removed. The current site uses these as a "guided tour" device. The product page doesn't need them; sections are self-contained and linked from nav.

### Responsive considerations
- Pricing cards: 2-column → stacked on mobile
- What You Get: 3-column → stacked on mobile
- 5-step strip: horizontal → scrollable or stacked on mobile
- Sticky nav: hide section links on mobile, keep only the logo and "Send your PRD →" CTA. No hamburger menu — the anchor links are a convenience, not critical navigation. Full link set returns at tablet breakpoint (~768px).
- Hero: already single-column, just needs padding adjustment

---

## What Gets Removed

| Current component | Disposition |
|---|---|
| `PipelineAnimation` in hero | Moved to "How It Works" section |
| Contrast list ("Not / Is" pairs) | Replaced by "What You Get" section |
| Section numbers (01, 02, 03) | Removed — sections are nav-anchored, not numbered |
| "See it run" / "Open console" CTAs | Replaced by "Send your PRD →" / "See pricing" |
| Console link in nav | Removed from primary nav. Console is an internal tool, not a buyer destination. Can remain accessible at /console but not promoted. |

---

## What Gets Added

| New element | Purpose |
|---|---|
| Sticky nav with CTA | Always-visible conversion + section navigation |
| Pricing section (2 cards) | The offer — Offer A primary, Offer B secondary |
| "What You Get" section | Buyer-facing deliverables replacing the contrast list |
| Scope constraints box | Honest boundaries, positioned as a feature |
| Upstream credibility box | Compressed gh-aw proof (31 findings, 17 fixes, 7 releases) |
| "First project free" messaging | Trust-building, repeated at hero, pricing, and bottom CTA |

---

## Files Changed

| File | Action | Notes |
|---|---|---|
| `web/app/page.tsx` | Modify | New section order, new imports, remove section numbers/dividers, add anchor IDs |
| `web/app/page.module.css` | Modify | Update nav styles for sticky behavior, adjust divider/spacing |
| `web/app/globals.css` | Minor modify | Add `html { scroll-behavior: smooth; }` for anchor link scrolling |
| `web/components/landing/hero.tsx` | Modify | New copy, remove animation, new CTAs |
| `web/components/landing/hero.module.css` | Modify | Single-column layout, no animation container |
| `web/components/landing/sticky-nav.tsx` | **New** | Client component with scroll detection, backdrop blur |
| `web/components/landing/sticky-nav.module.css` | **New** | Sticky positioning, blur, CTA button |
| `web/components/landing/pricing.tsx` | **New** | Two-card layout with tiers and scope box |
| `web/components/landing/pricing.module.css` | **New** | Card styles, tier lists, CTA buttons |
| `web/components/landing/contrast-list.tsx` | **Rename/Rewrite** | Becomes `what-you-get.tsx` — 3-column deliverables |
| `web/components/landing/contrast-list.module.css` | **Rename/Rewrite** | Becomes `what-you-get.module.css` |
| `web/components/landing/how-it-works.tsx` | Modify | Add PipelineAnimation, 5-step strip, credibility box |
| `web/components/landing/how-it-works.module.css` | Modify | Layout for animation + steps + credibility |
| `web/components/landing/evidence-ledger.tsx` | Modify | Update heading and subtitle text |
| `web/components/landing/bottom-cta.tsx` | Modify | New copy and CTA targets |
| `web/components/landing/bottom-cta.module.css` | Modify | Minor adjustments if needed |
| `web/components/landing/pipeline-animation.tsx` | No change | Reused as-is, rendered in new parent |
| `web/components/landing/pipeline-animation.module.css` | No change | — |

---

## Success Criteria

1. Landing page loads at prd-to-prod.vercel.app with the new structure
2. Sticky nav appears on scroll with working anchor links to #pricing, #how-it-works, and #for-teams
3. "Send your PRD →" CTA is visible in nav, hero, pricing card, and bottom CTA — all pointing to the same destination
4. Pricing section displays both offers with correct tiers and prices
5. Pipeline animation renders in the "How It Works" section (not the hero)
6. Evidence ledger still pulls live data from GitHub API
7. Page is responsive — pricing cards and deliverables stack on mobile, nav adapts
8. Build passes (`npm run build` in web/)
9. No console errors on load
10. "Powered by GitHub Agentic Workflows" appears in hero eyebrow and How It Works section label
