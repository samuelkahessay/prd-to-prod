# Pitch Page Design

> One-pager at `/pitch` for investor office hours, cold outreach, and event applications.

## Context

Applying to Platform Calgary x White Star Capital Seed Fund investor office hours (April 1, 2026). Need a reusable pitch page at `prdtoprod.com/pitch` that serves as a one-pager for this and future outreach.

Primary audience: seed-stage investors (White Star Capital — $50M Canadian seed fund) and founders at networking events. The ask is design partners, not fundraising.

## Route

`/pitch` — new page in `web/app/pitch/`

## Format

Classic one-pager article layout — same format as `/vision` and `/case-studies/aurrin-ventures`. Single column, 680px max-width, CSS modules, site design system (cream palette, DM Sans + JetBrains Mono).

Includes `StickyNav` header. No special components — static content page.

One addition to the standard article format: a stat strip below the one-liner (4 stats in a horizontal bar with mono numbers). Same pattern used in the mockup at `.superpowers/brainstorm/73890-1774626935/content/pitch-v7.html`.

## Sections (in order)

1. **Label + Title + One-liner**
   - Label: `prd-to-prod` (mono, uppercase, faint)
   - Title: "The delivery infrastructure for AI agents."
   - One-liner: "AI can write code. It can't ship software. We build the orchestration layer that turns capable agents into a governed, autonomous delivery pipeline."

2. **Stat strip** (4 stats)
   - 80 / Agent-merged PRs
   - 12 / Modules delivered
   - 6 / Days
   - 28 / Platform bugs found

3. **Problem**
   - Every company using AI to write code still needs engineers for everything around the code. The bottleneck is the orchestration — the infrastructure that wraps around agents to make them reliable and governable.

4. **Solution**
   - Pipeline built on GitHub's [Agentic Workflows](https://github.github.com/gh-aw/). Brief → decompose → implement → independent review → merge → deploy → self-heal.
   - Governance layer: autonomy policy, identity separation, dependency-aware orchestration, self-healing loops. Agents operate inside the system.

5. **Traction**
   - First client: [Aurrin Ventures](https://www.aurrinventures.ca/) — 12-module platform, 80 PRs, 133 issues, 6 days. Build ongoing.
   - Platform credibility: Top 3 leading contributor to gh-aw. 28 issues, 24 fixes, 15 release credits across 8 releases.
   - Signal: ["The New OSS"](https://skahessay.dev/posts/the-new-oss) endorsed by Peli de Halleux, amplified by GitHub Next. ["The Agent Interface"](https://skahessay.dev/posts/the-agent-interface) reposted by Don Syme. Three active MSFT/GitHub threads — all initiated by the other side.

6. **Market**
   - GitHub 100M+ developers, building agent-native infra. Factory $70M (Sequoia). Mendral (YC W26). Governance layer is the opportunity.

7. **Business model**
   - Founder builds ($750–$5K)
   - Team setups ($3K–$7.5K + $1.5K/mo)
   - Services today, pipeline is the long-term product.

8. **Team**
   - [Samuel Kahessay](https://linkedin.com/in/samuelkahessay) — solo founder. Amazon SDE (Alexa Edge ML), ATB Financial (data science), UofC research (NSERC grant). Currently at Upzoids (smart city platforms).
   - Looking for co-founder with GTM or infrastructure experience.

9. **Ask: design partners**
   - Early-stage companies that need software built. Standard SaaS stack (Next.js, Postgres, Stripe, auth).
   - Contact: kahessay@icloud.com, LinkedIn, prdtoprod.com

## Styling

Reuse the existing article page CSS pattern from `/case-studies/aurrin-ventures/page.module.css` with these additions:

- `.stats` — horizontal flex strip with 1px gap dividers, rounded border, warm-white backgrounds
- `.stat-number` — mono font, 1.5rem
- `.stat-label` — 0.8rem, muted color
- Responsive: stats stack vertically on mobile

All other styles (`.label`, `.title`, `.lede`/`.one-liner`, `.divider`, `.article`, `h2`, `ul`, `code`, `a`) already exist in the pattern.

## What this is NOT

- Not a pitch deck (no slides, no animations)
- Not the vision page (no thesis, no competitive positioning chart)
- Not the case study (shorter, broader scope)
- No unverifiable competitive claims
- No name-dropping (no Hashimoto reference)

## Metadata

```ts
export const metadata: Metadata = {
  title: "Pitch — prd-to-prod",
  description: "Autonomous delivery infrastructure for AI agents. One-pager.",
  robots: { index: false, follow: false }, // not for SEO, for direct sharing
};
```
