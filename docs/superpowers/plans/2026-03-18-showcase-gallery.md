# Showcase Gallery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-layer showcase system — landing page carousel, /showcase gallery, and 5 functional app pages — so visitors can see and interact with apps the pipeline built.

**Architecture:** Shared data layer reads `showcase/*/manifest.json` + `showcase/*/README.md` at build time. A carousel strip component on the landing page links to `/showcase`. The gallery page renders all 5 apps as cards. Each `/showcase/[slug]` page uses a split-view layout (260px sidebar + app area). All 5 apps are client-side React components using localStorage for persistence.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, CSS Modules, localStorage

**Spec:** `docs/superpowers/specs/2026-03-18-showcase-gallery-design.md`

---

## Chunk 1: Shared Data Layer + Types

### Task 1: Showcase data types and loader

**Files:**
- Create: `studio/lib/showcase-data.ts`

This is the single source of truth for showcase metadata. It reads the manifest.json files at build time (or import time — they're static JSON in the repo) and exposes typed data for all showcase components.

- [ ] **Step 1: Write the type definitions and data loader**

```typescript
// studio/lib/showcase-data.ts

export interface ShowcaseApp {
  slug: string;
  run: number;
  name: string;
  tag: string;
  techStack: string;
  originalStack: string | null; // non-null for ported apps, e.g., "ASP.NET Core + C#"
  date: string;
  prdPath: string;
  prdUrl: string; // GitHub blob URL at tagged commit
  issueCount: number;
  prCount: number;
  description: string;
  // Optional metrics — only when explicitly present in README
  linesAdded?: number;
  filesChanged?: number;
  testsWritten?: number;
  themes?: number;
}

// Static data derived from showcase/*/manifest.json and showcase/*/README.md
// This avoids runtime file reads — all data is known at build time
export const SHOWCASE_APPS: ShowcaseApp[] = [
  {
    slug: "code-snippets",
    run: 1,
    name: "Code Snippet Manager",
    tag: "v1.0.0",
    techStack: "Express + TS",
    originalStack: null,
    date: "2026-02",
    prdPath: "docs/prd/sample-prd.md",
    prdUrl: "https://github.com/samuelkahessay/prd-to-prod/blob/v1.0.0/docs/prd/sample-prd.md",
    issueCount: 8,
    prCount: 7,
    description: "Save, tag, and search code snippets with full-text search",
  },
  {
    slug: "observatory",
    run: 2,
    name: "Pipeline Observatory",
    tag: "v2.0.0",
    techStack: "Next.js 14 + TS",
    originalStack: null,
    date: "2026-02",
    prdPath: "docs/prd/pipeline-observatory-prd.md",
    prdUrl: "https://github.com/samuelkahessay/prd-to-prod/blob/v2.0.0/docs/prd/pipeline-observatory-prd.md",
    issueCount: 12,
    prCount: 19,
    description: "Interactive pipeline visualizer with timeline replay and forensic inspection",
    testsWritten: 32,
  },
  {
    slug: "devcard",
    run: 3,
    name: "DevCard",
    tag: "v3.0.0",
    techStack: "Next.js 14 + Framer",
    originalStack: null,
    date: "2026-02",
    prdPath: "docs/prd/devcard-prd.md",
    prdUrl: "https://github.com/samuelkahessay/prd-to-prod/blob/v3.0.0/docs/prd/devcard-prd.md",
    issueCount: 17,
    prCount: 22,
    description: "GitHub profile card generator with 6 themes and PNG export",
    themes: 6,
  },
  {
    slug: "ticket-deflection",
    run: 4,
    name: "Ticket Deflection",
    tag: "v4.0.0",
    techStack: "Next.js (showcase)",
    originalStack: "ASP.NET Core + C#",
    date: "2026-02",
    prdPath: "docs/prd/ticket-deflection-prd.md",
    prdUrl: "https://github.com/samuelkahessay/prd-to-prod/blob/v4.0.0/docs/prd/ticket-deflection-prd.md",
    issueCount: 52,
    prCount: 37,
    description: "Support ticket classifier that auto-resolves common issues and escalates complex cases",
    linesAdded: 3987,
    filesChanged: 119,
  },
  {
    slug: "compliance",
    run: 5,
    name: "Compliance Scanner",
    tag: "v5.0.0",
    techStack: "Next.js (showcase)",
    originalStack: "ASP.NET Core + C#",
    date: "2026-03",
    prdPath: "docs/prd/run-07-compliance-scan-service-prd.md",
    prdUrl: "https://github.com/samuelkahessay/prd-to-prod/blob/v5.0.0/docs/prd/run-07-compliance-scan-service-prd.md",
    issueCount: 8,
    prCount: 8,
    description: "PIPEDA + FINTRAC regulatory scanner with auto-block and human escalation",
  },
];

export function getShowcaseApp(slug: string): ShowcaseApp | undefined {
  return SHOWCASE_APPS.find((app) => app.slug === slug);
}
```

- [ ] **Step 2: Write test for data loader**

```typescript
// studio/test/showcase-data.test.ts
import { SHOWCASE_APPS, getShowcaseApp } from "@/lib/showcase-data";

describe("showcase-data", () => {
  it("has 5 apps", () => {
    expect(SHOWCASE_APPS).toHaveLength(5);
  });

  it("all apps have required fields", () => {
    for (const app of SHOWCASE_APPS) {
      expect(app.slug).toBeTruthy();
      expect(app.run).toBeGreaterThan(0);
      expect(app.name).toBeTruthy();
      expect(app.issueCount).toBeGreaterThan(0);
      expect(app.prCount).toBeGreaterThan(0);
      expect(app.prdUrl).toMatch(/^https:\/\/github\.com/);
    }
  });

  it("ported apps have originalStack", () => {
    const ported = SHOWCASE_APPS.filter((a) => a.originalStack);
    expect(ported).toHaveLength(2);
    expect(ported.map((a) => a.slug)).toEqual(["ticket-deflection", "compliance"]);
  });

  it("getShowcaseApp returns correct app", () => {
    expect(getShowcaseApp("devcard")?.name).toBe("DevCard");
    expect(getShowcaseApp("nonexistent")).toBeUndefined();
  });

  it("optional metrics only present when source has them", () => {
    const observatory = getShowcaseApp("observatory")!;
    expect(observatory.testsWritten).toBe(32);

    const snippets = getShowcaseApp("code-snippets")!;
    expect(snippets.linesAdded).toBeUndefined();
    expect(snippets.testsWritten).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd studio && npm test -- --testPathPattern showcase-data`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add studio/lib/showcase-data.ts studio/test/showcase-data.test.ts
git commit -m "feat: add showcase data types and loader"
```

---

## Chunk 2: Landing Page Carousel Strip

### Task 2: Showcase carousel component

**Files:**
- Create: `studio/components/landing/showcase-strip.tsx`
- Create: `studio/components/landing/showcase-strip.module.css`
- Modify: `studio/app/page.tsx` (insert carousel between WhatYouGet and HowItWorks)

- [ ] **Step 1: Create the carousel component**

Build `ShowcaseStrip` as a server component (no `"use client"` — it has no state or effects, just links and scroll-snap CSS) that renders:
- Section label "Showcase" (uppercase mono, like other landing sections)
- Heading "Built by the pipeline"
- Subtitle "5 apps. 5 PRDs. Each one autonomously decomposed, implemented, reviewed, and merged."
- Horizontally scrollable container with 6 cards (5 apps + CTA)

Each app card shows:
- Run number label (e.g., "Run 01")
- Tech stack badge (top right). For ported apps: "ASP.NET → Next.js"
- App name (h3)
- One-line description
- Stats row: issue count, PR count, plus optional third metric (testsWritten, themes, linesAdded)
- Date (bottom left), "Open showcase →" link (bottom right, links to `/showcase/${slug}`)

CTA card (6th):
- Dashed border instead of solid
- "Your PRD could be next" heading
- "Send us a product spec. Get back a deployed app." subtitle
- "Get started →" link to `/build`

**CSS requirements:**
- Container: `overflow-x: auto; scroll-snap-type: x mandatory;`
- Cards: `min-width: 300px; scroll-snap-align: start;`
- Use existing CSS variables: `--surface`, `--ink`, `--ink-muted`, `--ink-faint`, `--rule`, `--font-mono`, `--font-sans`
- Card style: `background: var(--warm-white); border: 1px solid var(--rule); border-radius: 8px;`
- CTA card: `border: 1px dashed var(--rule-strong); background: transparent;`
- Responsive: at `max-width: 768px`, cards become single-width swipeable
- "See all →" link below the strip, pointing to `/showcase`

Reference tagged source behavior and the existing landing page component patterns (`what-you-get.tsx`, `pricing.tsx`) for styling conventions.

- [ ] **Step 2: Add the strip to the landing page**

Modify `studio/app/page.tsx`:
- Import `ShowcaseStrip` from `@/components/landing/showcase-strip`
- `ShowcaseStrip` is a server component, so it can be imported directly into the server component `LandingPage` with no special handling
- Insert between `<WhatYouGet />` and `<HowItWorks />` with dividers:

```tsx
<hr className={styles.divider} />
<WhatYouGet />

<hr className={styles.divider} />
<ShowcaseStrip />

<hr className={styles.divider} />
<HowItWorks />
```

- [ ] **Step 3: Verify locally**

Run: `cd studio && npm run dev`
- Open http://localhost:3000
- Scroll to the carousel section
- Verify 5 app cards + CTA card render
- Verify horizontal scroll works
- Verify "Open showcase →" links point to correct slugs
- Verify responsive behavior at mobile width

- [ ] **Step 4: Commit**

```bash
git add studio/components/landing/showcase-strip.tsx studio/components/landing/showcase-strip.module.css studio/app/page.tsx
git commit -m "feat: add showcase carousel strip to landing page"
```

---

## Chunk 3: Gallery Page + App Shell Layout

### Task 3: /showcase gallery page

**Files:**
- Create: `studio/app/showcase/page.tsx`
- Create: `studio/app/showcase/page.module.css`

- [ ] **Step 1: Create the gallery page**

Server component that renders a 2-column grid of showcase app cards.

**Page structure:**
- Header section: "Showcase" label, "Built by the pipeline" heading, explanatory subtitle
- 2-column grid (responsive to 1-column on mobile)
- Each card: preview placeholder (180px tall, colored gradient), run number, app name, tech stack badge, description, stats, two actions ("Open app →" linking to `/showcase/${slug}`, "View PRD" linking to `app.prdUrl`)
- CTA card at bottom: "Your PRD could be next" with dashed border, link to `/build`

**CSS requirements:**
- Grid: `display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;`
- Mobile: `grid-template-columns: 1fr;`
- Card preview area: `height: 180px;` with distinct gradient per app (derive from run number)
- Use landing page CSS variable palette
- Card border/radius matching existing `.card` pattern

Import `SHOWCASE_APPS` from `@/lib/showcase-data` for card data.

- [ ] **Step 2: Verify locally**

Run: `cd studio && npm run dev`
- Open http://localhost:3000/showcase
- Verify all 5 app cards render in 2-column grid
- Verify "Open app →" links work
- Verify "View PRD" links open correct GitHub URLs
- Verify CTA card renders at bottom
- Check mobile layout at 375px width

- [ ] **Step 3: Commit**

```bash
git add studio/app/showcase/page.tsx studio/app/showcase/page.module.css
git commit -m "feat: add /showcase gallery page"
```

### Task 4: /showcase/[slug] layout with sidebar

**Files:**
- Create: `studio/app/showcase/[slug]/layout.tsx`
- Create: `studio/app/showcase/[slug]/layout.module.css`
- Create: `studio/app/showcase/[slug]/page.tsx` (placeholder that renders the correct app component)

- [ ] **Step 1: Create the split-view layout**

`layout.tsx` is an `async` server component that:
- Awaits `slug` from params (`const { slug } = await params;` — in Next.js 15, `params` is a `Promise<{slug: string}>`)
- Looks up `getShowcaseApp(slug)` — returns 404 if not found
- Renders the sidebar with:
  - "← Back to showcase" link (`/showcase`)
  - App name
  - Tech stack badge (with "Originally {originalStack}" if ported)
  - Description
  - Pipeline stats: "{issueCount} issues decomposed", "{prCount} PRs merged", plus any optional metrics
  - "View PRD →" link (to `app.prdUrl`)
- Renders `{children}` in the main area

**CSS:**
- Layout: `display: flex; min-height: 100vh;`
- Sidebar: `width: 260px; flex-shrink: 0; border-right: 1px solid var(--rule);`
- Main: `flex: 1; overflow-y: auto;`
- Mobile (`max-width: 768px`): sidebar becomes a fixed top bar with app name + badge + a "Details" button that toggles the full stats section. Use a `<details>` element for the toggle — native HTML, no JS state needed.

- [ ] **Step 2: Create the page component that routes to app**

`page.tsx` is a client component that:
- Reads `slug` from params
- Renders the correct showcase app component based on slug
- Uses a simple switch/map pattern:

```tsx
"use client";

import { use } from "react";

// Lazy-load each app to avoid bundling all 5 in every page
import dynamic from "next/dynamic";

const APPS: Record<string, ReturnType<typeof dynamic>> = {
  "code-snippets": dynamic(() => import("@/components/showcase/code-snippets/app")),
  "observatory": dynamic(() => import("@/components/showcase/observatory/app")),
  "devcard": dynamic(() => import("@/components/showcase/devcard/app")),
  "ticket-deflection": dynamic(() => import("@/components/showcase/ticket-deflection/app")),
  "compliance": dynamic(() => import("@/components/showcase/compliance/app")),
};

export default function ShowcaseAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const AppComponent = APPS[slug];
  if (!AppComponent) return <div>App not found</div>;
  return <AppComponent />;
}
```

- [ ] **Step 3: Create placeholder app components**

Create 5 placeholder files so the dynamic imports resolve:

```
studio/components/showcase/code-snippets/app.tsx
studio/components/showcase/observatory/app.tsx
studio/components/showcase/devcard/app.tsx
studio/components/showcase/ticket-deflection/app.tsx
studio/components/showcase/compliance/app.tsx
```

Each one is a minimal placeholder:

```tsx
"use client";
export default function App() {
  return <div style={{ padding: 40 }}>Coming soon</div>;
}
```

- [ ] **Step 4: Verify locally**

Run: `cd studio && npm run dev`
- Open http://localhost:3000/showcase/devcard
- Verify sidebar renders with correct DevCard metadata
- Verify "← Back to showcase" link works
- Verify "Coming soon" placeholder renders in main area
- Verify 404 at http://localhost:3000/showcase/nonexistent
- Check mobile layout — top bar with Details toggle

- [ ] **Step 5: Run tests**

Run: `cd studio && npm test`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add studio/app/showcase/[slug]/ studio/components/showcase/
git commit -m "feat: add showcase app shell with sidebar layout"
```

---

## Chunk 4: Showcase App — Code Snippet Manager (Run 01)

### Task 5: Code Snippet Manager app

**Files:**
- Create: `studio/components/showcase/code-snippets/app.tsx`
- Create: `studio/components/showcase/code-snippets/app.module.css`
- Create: `studio/components/showcase/code-snippets/store.ts`

**Behavioral source of truth:** `git show v1.0.0` — Express + TypeScript CRUD app with EJS templates.

**Core user journey to reproduce:**
1. Landing view: list of snippets with tags, search bar
2. Create snippet: title, code content, language, tags
3. View snippet: syntax-highlighted code, metadata, tags
4. Search: full-text search across title and content
5. Tag filtering: click tag to filter snippets

**Data model:**

```typescript
interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: string;
}
```

- [ ] **Step 1: Build the localStorage store**

`store.ts` — a hook-based store that:
- Seeds localStorage with 4-5 example snippets on first visit (check for key `showcase-snippets-seeded`)
- Provides `useSnippets()` hook returning `{ snippets, addSnippet, deleteSnippet, searchSnippets }`
- `searchSnippets(query)` does case-insensitive substring match on title + code
- All CRUD persists to `localStorage` under key `showcase-snippets`
- **SSR safety:** All `localStorage` reads must happen inside `useEffect` (not during render). Initialize state with empty/default values, then hydrate from localStorage in a `useEffect`. This prevents `ReferenceError: localStorage is not defined` during `npm run build`.

- [ ] **Step 2: Build the app component**

`app.tsx` — a single-page app with:
- Search bar at top
- Tag filter row (unique tags from all snippets, clickable to filter)
- Snippet list (cards showing title, language badge, tags, truncated code preview)
- "New Snippet" button that opens an inline form (title, code textarea, language select, tags input)
- Click a snippet to expand/view full code
- Delete button on each snippet

**Styling:** Use CSS modules. Follow the existing `--surface`, `--ink`, `--rule` palette. Code blocks use `--font-mono`.

- [ ] **Step 3: Verify locally**

Run: `cd studio && npm run dev`
- Open http://localhost:3000/showcase/code-snippets
- Verify seed data populates on first visit
- Create a snippet, refresh, verify it persists
- Search for a snippet, verify filtering works
- Click a tag, verify filtering works

- [ ] **Step 4: Commit**

```bash
git add studio/components/showcase/code-snippets/
git commit -m "feat: add Code Snippet Manager showcase app"
```

---

## Chunk 5: Showcase App — Pipeline Observatory (Run 02)

### Task 6: Pipeline Observatory app

**Files:**
- Create: `studio/components/showcase/observatory/app.tsx`
- Create: `studio/components/showcase/observatory/app.module.css`
- Create: `studio/components/showcase/observatory/fixtures.ts`

**Behavioral source of truth:** `git show v2.0.0` — Next.js 14 dashboard with SVG node graph, timeline, forensics.

**Core user journey to reproduce:**
1. Landing: three view cards (Simulator, Replay, Forensics) with descriptions
2. Simulator: interactive SVG node graph showing pipeline stages (Decompose → Build → Review → Gate → Ship). Click nodes to see detail panels. Animated particle flow between nodes.
3. Replay: timeline of the Code Snippet Manager run — events plotted chronologically, clickable to see details
4. Forensics: failure timeline showing CI failures and their resolutions

**Data:** Use fixture data embedded in `fixtures.ts`. The original app had fixture fallback for GitHub data — showcase version uses fixtures exclusively.

- [ ] **Step 1: Create fixture data**

`fixtures.ts` — hardcoded data representing:
- Pipeline nodes (5 stages with status, description)
- Timeline events from Run 01 (issues created, PRs opened/merged, key timestamps)
- Failure events (3-4 CI failures with resolution descriptions)

- [ ] **Step 2: Build the app component**

`app.tsx` — tabbed layout with three views:
- **Simulator tab:** SVG rendering of 5 pipeline nodes connected by arrows. Nodes are clickable — clicking shows a detail panel below with stage description and status. Animate with simple CSS: pulsing glow on active nodes (`@keyframes` opacity cycle), dashed stroke animation on connecting arrows (`stroke-dashoffset` animation). No path-following particles — keep it simple. Respect `prefers-reduced-motion` (disable animations when set).
- **Replay tab:** Horizontal timeline of Run 01 events. Each event is a dot on the timeline, color-coded by type (issue=blue, PR=green, merge=gold). Click to see event details.
- **Forensics tab:** List of CI failure events with severity, error description, and resolution. Each entry expandable.

**Styling:** Dark theme within the app area to match the original Blueprint×Terminal aesthetic. Use a scoped dark class — do not modify global styles.

- [ ] **Step 3: Verify locally**

- Open http://localhost:3000/showcase/observatory
- Verify three tabs render and switch correctly
- Verify SVG node graph renders with clickable nodes
- Verify timeline shows chronological events
- Verify forensics list is expandable

- [ ] **Step 4: Commit**

```bash
git add studio/components/showcase/observatory/
git commit -m "feat: add Pipeline Observatory showcase app"
```

---

## Chunk 6: Showcase App — DevCard (Run 03)

### Task 7: DevCard app

**Files:**
- Create: `studio/components/showcase/devcard/app.tsx`
- Create: `studio/components/showcase/devcard/app.module.css`
- Create: `studio/components/showcase/devcard/fixtures.ts`
- Create: `studio/components/showcase/devcard/themes.ts`

**Behavioral source of truth:** `git show v3.0.0` — Next.js 14 + Framer Motion dev card generator.

**Core user journey to reproduce:**
1. Landing: username input form + gallery of notable developers
2. Enter a username → renders a DevCard with profile, language breakdown, top repos
3. Theme selector: 6 themes (Midnight, Aurora, Sunset, Neon, Arctic, Mono)
4. Gallery: grid of pre-generated cards for notable developers

**Adaptation:** Uses curated fixture profiles (no live GitHub API). The sidebar should note "Uses curated profiles. Original run fetched live GitHub data."

- [ ] **Step 1: Create fixture profiles**

`fixtures.ts` — 5-6 hardcoded developer profiles with:
- Username, name, avatar URL (use GitHub avatar CDN: `https://avatars.githubusercontent.com/u/{id}`), bio, stats
- Top repos (3 per user, with stars/language)
- Language breakdown (top 5 languages with percentages and colors)

Include: `torvalds`, `gaearon` (Dan Abramov), `steipete` (Peter Steinberger), `rauchg` (Guillermo Rauch), `sindresorhus`

- [ ] **Step 2: Create theme definitions**

`themes.ts` — 6 theme objects, each with:
- `name`, `background`, `foreground`, `accent`, `cardBg`, `cardBorder`

Themes: Midnight (dark blue), Aurora (green/purple gradient), Sunset (warm orange), Neon (black/green), Arctic (light blue), Mono (grayscale)

- [ ] **Step 3: Build the app component**

`app.tsx`:
- Text input for username (searches fixture profiles, shows match or "Profile not available")
- DevCard renderer: avatar, name, bio, stats row (repos/followers/following), language breakdown bar, top repos list
- Theme selector: 6 clickable swatches below the card
- Gallery: grid of all fixture profiles rendered as mini cards

- [ ] **Step 4: Verify locally**

- Open http://localhost:3000/showcase/devcard
- Type "torvalds" → card renders with Linus's profile
- Switch themes → card appearance changes
- Gallery shows all fixture profiles
- Type unknown username → graceful "not available" message

- [ ] **Step 5: Commit**

```bash
git add studio/components/showcase/devcard/
git commit -m "feat: add DevCard showcase app"
```

---

## Chunk 7: Showcase App — Ticket Deflection (Run 04)

### Task 8: Ticket Deflection app

**Files:**
- Create: `studio/components/showcase/ticket-deflection/app.tsx`
- Create: `studio/components/showcase/ticket-deflection/app.module.css`
- Create: `studio/components/showcase/ticket-deflection/store.ts`
- Create: `studio/components/showcase/ticket-deflection/classifier.ts`
- Create: `studio/components/showcase/ticket-deflection/seed-data.ts`

**Behavioral source of truth:** `git show v4.0.0` — ASP.NET Core ticket deflection service.

**Core user journey to reproduce:**
1. Dashboard: metrics overview (total tickets, deflection rate, category breakdown as doughnut chart)
2. Submit ticket: form with title + description
3. Pipeline processes ticket: classify category/severity → match knowledge base → auto-resolve or escalate
4. Ticket feed: live list of tickets with status badges (New → Classified → Matched → AutoResolved/Escalated)
5. Simulate: button that generates batch of demo tickets and processes them
6. Activity log: chronological timeline of all ticket events

**Data model:**

```typescript
enum TicketCategory { Bug = "Bug", FeatureRequest = "FeatureRequest", HowTo = "HowTo", AccountIssue = "AccountIssue", Other = "Other" }
enum TicketSeverity { Low = "Low", Medium = "Medium", High = "High", Critical = "Critical" }
enum TicketStatus { New = "New", Classified = "Classified", Matched = "Matched", AutoResolved = "AutoResolved", Escalated = "Escalated" }

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory | null;
  severity: TicketSeverity | null;
  status: TicketStatus;
  resolution: string | null;
  createdAt: string;
}

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: TicketCategory;
}

interface ActivityLogEntry {
  id: string;
  ticketId: string;
  action: string;
  details: string;
  timestamp: string;
}
```

- [ ] **Step 1: Create seed data**

`seed-data.ts` — 12+ knowledge base articles and 8-10 pre-existing tickets at various statuses. Articles cover common categories: password reset, billing questions, API errors, feature requests.

- [ ] **Step 2: Create the classifier**

`classifier.ts` — client-side ticket classification logic:
- `classifyTicket(title, description)`: keyword-based category and severity assignment (mirrors `ClassificationService.cs`)
- `matchKnowledgeBase(ticket, articles)`: Jaccard similarity matching (mirrors `MatchingService.cs`)
- `processTicket(ticket, articles)`: full pipeline — classify → match → auto-resolve (if match score > 0.3) or escalate

- [ ] **Step 3: Create the localStorage store**

`store.ts` — hook-based store:
- Seeds on first visit with pre-existing tickets + knowledge base articles
- `useTicketStore()` returns `{ tickets, articles, activityLog, submitTicket, simulateTickets, clearTickets }`
- `submitTicket` runs the full classification pipeline and logs activity
- `simulateTickets` generates 5-10 random tickets and processes them
- All state persisted under `showcase-tickets-*` localStorage keys
- **SSR safety:** All `localStorage` reads must happen inside `useEffect`, not during render. Initialize with empty arrays, hydrate in `useEffect`.

- [ ] **Step 4: Build the app component**

`app.tsx` — tabbed layout with three views:
- **Dashboard tab:** Stats cards (total, deflection rate, by-category, by-severity) + doughnut charts (use a simple SVG doughnut, no Chart.js dependency)
- **Tickets tab:** Submit form + scrollable ticket feed with status badges + "Simulate" button
- **Activity tab:** Chronological log of all ticket events

Styling: Follow the Blueprint×Terminal aesthetic from the original (dark navy background, cyan accents, monospace labels). Scope with a CSS class on the root div.

- [ ] **Step 5: Verify locally**

- Open http://localhost:3000/showcase/ticket-deflection
- Dashboard shows seed data metrics
- Submit a ticket → watch it process through statuses
- Click "Simulate" → batch of tickets appear with various outcomes
- Activity tab shows full event log
- Refresh → data persists

- [ ] **Step 6: Commit**

```bash
git add studio/components/showcase/ticket-deflection/
git commit -m "feat: add Ticket Deflection showcase app (ported from ASP.NET)"
```

---

## Chunk 8: Showcase App — Compliance Scanner (Run 05)

### Task 9: Compliance Scanner app

**Files:**
- Create: `studio/components/showcase/compliance/app.tsx`
- Create: `studio/components/showcase/compliance/app.module.css`
- Create: `studio/components/showcase/compliance/scanner.ts`
- Create: `studio/components/showcase/compliance/seed-data.ts`
- Create: `studio/components/showcase/compliance/store.ts`

**Behavioral source of truth:** `git show v5.0.0` — ASP.NET Core compliance scanner.

**Core user journey to reproduce:**
1. Scan input: text area to paste code/diff/log/freetext, select content type, submit for scanning
2. Scan results: list of findings with regulation (PIPEDA/FINTRAC), severity, disposition (AUTO_BLOCK/ADVISORY/HUMAN_REQUIRED)
3. Operator decision: HUMAN_REQUIRED findings show an approve/reject interface
4. Scan history: list of past scans with disposition summary
5. Dashboard: metrics (total scans, findings by regulation, disposition breakdown)

**Data model:**

```typescript
enum ComplianceDisposition { AutoBlock = "AUTO_BLOCK", HumanRequired = "HUMAN_REQUIRED", Advisory = "ADVISORY" }
enum ComplianceRegulation { PIPEDA = "PIPEDA", FINTRAC = "FINTRAC" }
enum FindingSeverity { Low = "Low", Medium = "Medium", High = "High", Critical = "Critical" }
enum ContentType { Code = "CODE", Diff = "DIFF", Log = "LOG", Freetext = "FREETEXT" }

interface ComplianceScan {
  id: string;
  submittedAt: string;
  contentType: ContentType;
  sourceLabel: string;
  content: string;
  disposition: ComplianceDisposition;
  findings: ComplianceFinding[];
  operatorDecision?: "approved" | "rejected";
}

interface ComplianceFinding {
  id: string;
  regulation: ComplianceRegulation;
  severity: FindingSeverity;
  disposition: ComplianceDisposition;
  ruleId: string;
  description: string;
  lineNumber?: number;
  codeSnippet?: string;
}
```

- [ ] **Step 1: Create the scanner**

`scanner.ts` — deterministic rule-based scanning:
- Pattern matching for PIPEDA violations (PII in logs, unencrypted storage, consent gaps)
- Pattern matching for FINTRAC violations (unreported transactions, missing KYC, threshold breaches)
- Disposition classification: Critical findings → AUTO_BLOCK, ambiguous → HUMAN_REQUIRED, low-risk → ADVISORY
- Returns array of findings with populated fields

- [ ] **Step 2: Create seed data**

`seed-data.ts` — pre-populated scans:
- 1 HUMAN_REQUIRED scan awaiting operator decision (key demo requirement)
- 1 AUTO_BLOCK scan with critical findings
- 1 ADVISORY scan with low-risk findings
- 1 clean scan
- Populate dashboard metrics from this seed data

- [ ] **Step 3: Create the store**

`store.ts`:
- Seeds on first visit
- `useComplianceStore()` returns `{ scans, submitScan, recordDecision, getMetrics }`
- `submitScan(content, contentType)` runs the scanner and adds results
- `recordDecision(scanId, decision)` records operator approve/reject on HUMAN_REQUIRED scans
- Persisted under `showcase-compliance-*` localStorage keys
- **SSR safety:** All `localStorage` reads must happen inside `useEffect`, not during render. Initialize with empty arrays, hydrate in `useEffect`.

- [ ] **Step 4: Build the app component**

`app.tsx` — tabbed layout:
- **Scan tab:** Textarea + content type selector + "Scan" button. Results panel shows findings list with color-coded dispositions. HUMAN_REQUIRED findings have "Approve" / "Reject" buttons.
- **History tab:** List of past scans with disposition badge, timestamp, content type
- **Dashboard tab:** Metrics cards (total scans, by-regulation, by-disposition breakdown)

Styling: Dark theme scoped to the app. Use red for AUTO_BLOCK, amber for HUMAN_REQUIRED, green for ADVISORY.

- [ ] **Step 5: Verify locally**

- Open http://localhost:3000/showcase/compliance
- Seed data shows at least one HUMAN_REQUIRED scan
- Submit new scan with sample code → findings render
- Click Approve on HUMAN_REQUIRED finding → status updates
- History tab shows all scans
- Dashboard metrics update after new scans

- [ ] **Step 6: Commit**

```bash
git add studio/components/showcase/compliance/
git commit -m "feat: add Compliance Scanner showcase app (ported from ASP.NET)"
```

---

## Chunk 9: Screenshots + Final Integration

### Task 10: Capture screenshots and final polish

**Files:**
- Create: `studio/public/showcase/` (directory)
- Create: `studio/public/showcase/code-snippets.png`
- Create: `studio/public/showcase/observatory.png`
- Create: `studio/public/showcase/devcard.png`
- Create: `studio/public/showcase/ticket-deflection.png`
- Create: `studio/public/showcase/compliance.png`
- Modify: `studio/app/showcase/page.tsx` (wire screenshot images into preview areas)

- [ ] **Step 1: Capture screenshots**

With the dev server running at `localhost:3000`, capture each app's landing state. Use the `/browse` skill or take manual screenshots at 1200×800 viewport.

Save to `studio/public/showcase/`:
- `code-snippets.png`
- `observatory.png`
- `devcard.png`
- `ticket-deflection.png`
- `compliance.png`

```bash
mkdir -p studio/public/showcase
```

If screenshots cannot be captured (e.g., no browser available), the gallery page should fall back to gradient placeholders — the `<Image>` tags should be wrapped in a conditional that checks if the file exists, with a styled `<div>` fallback using a gradient derived from the run number.

- [ ] **Step 2: Wire screenshots into gallery page**

Update the gallery cards in `studio/app/showcase/page.tsx` to use `<Image>` from `next/image` in the preview areas:

```tsx
import Image from "next/image";
// ...
<Image
  src={`/showcase/${app.slug}.png`}
  alt={`${app.name} screenshot`}
  width={600}
  height={360}
  style={{ objectFit: "cover", width: "100%", height: "100%" }}
/>
```

- [ ] **Step 3: End-to-end verification**

Run: `cd studio && npm run build && npm run start`

Full flow check:
1. Landing page → scroll to carousel → see 5 cards + CTA
2. Click "Open showcase →" on any card → goes to /showcase/[slug]
3. Click "See all →" → goes to /showcase gallery
4. Gallery shows 5 cards with screenshots + CTA
5. Click "Open app →" → split view with sidebar + functional app
6. Each app works: create/search/filter/submit/scan
7. Sidebar shows correct metadata and "View PRD →" links
8. Mobile layout works (carousel swipeable, gallery single-column, sidebar collapses)

- [ ] **Step 4: Run all tests**

Run: `cd studio && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add studio/public/showcase/ studio/app/showcase/
git commit -m "feat: add showcase screenshots and final gallery integration"
```

---

## Task Dependencies

```
Task 1 (data layer) ──┬── Task 2 (carousel strip)
                       ├── Task 3 (gallery page)
                       └── Task 4 (app shell) ──┬── Task 5 (Code Snippets)
                                                ├── Task 6 (Observatory)
                                                ├── Task 7 (DevCard)
                                                ├── Task 8 (Ticket Deflection)
                                                └── Task 9 (Compliance Scanner)

Tasks 5-9 are independent of each other and can be parallelized.

Task 10 (screenshots + integration) depends on all of Tasks 5-9.
```
