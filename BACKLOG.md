# Backlog

## Inbox

- 2026-03-21 [bug] Factory celebration fires on provisioning complete, should fire on target repo pipeline complete
- 2026-03-21 [bug] OAuth grant TTL too short (10 min, should be 30-60 min for real users)
- 2026-03-21 [bug] Skip /finalize for already-ready sessions (400 error flash before provisioning)
- 2026-03-21 [infra] Scaffold golden file (expected-tree.txt) is fragile — consider automating regeneration
- 2026-03-21 [feature] Build route redesign: gate order should be access code -> BYOK -> chat
- 2026-03-21 [feature] Credential persistence for returning users (don't re-enter Copilot token)
- 2026-03-21 [infra] File upstream gh-aw issues (#040, #041, #042, #043)
- 2026-03-21 [feature] Private repos as a user configuration option (currently public for free Actions minutes)
- 2026-03-22 [upstream] gh-aw CLI should expose more info on run status for workflows — `gh run view` only shows status/conclusion, no step-level detail or agent output. File as gh-aw upstream issue.
- 2026-03-23 [upstream] gh-aw safe-outputs prompt says "exactly one safe-output tool" even when workflow config allows multiple calls (max: 20). Causes ~50% decomposer no-ops. **Filed: github/gh-aw#22364**
- 2026-03-23 [infra] Auto-dispatch guard blocks new issue dispatches when stale repo-assist runs (from issue_comment events) are still in_progress. Causes semi-autonomous gap — need to either shorten comment-triggered run lifetime or make the guard smarter.
- 2026-03-23 [infra] Pull old gh-aw upstream findings from T9 Samsung SSD — previous findings data may be on external drive, not in current repo.
- 2026-03-25 [feature] Replace contact email on landing page with a waitlist signup
- 2026-03-25 [feature] Demo route: replace mock LLM chat with preconfigured scenario and play button
- 2026-03-25 [bug] PRD chat UI/UX needs polish — improve the LLM conversation experience in /build (see #535)
- 2026-03-25 [debt] Refactor studio/ to use src/ directory convention (standard Next.js layout)
- 2026-03-25 [idea] Marketing: compare prd-to-prod against repos listed on TikTok's GitHub Awesome account for positioning
- 2026-03-25 [idea] Marketing: get business cards for prd-to-prod
- 2026-03-25 [bug] Mobile nav overlay is broken — doesn't cover page content, links render on top of hero text, untappable
- 2026-03-25 [bug] Anchor links (#how-it-works, #pricing) don't scroll to sections — stay at top or jump unpredictably
- 2026-03-25 [bug] H1 missing space: "Send a PRD.Get a deployed app" — no space after first period
- 2026-03-25 [feature] Add skip-to-content link for keyboard/screen reader users
- 2026-03-25 [debt] Add aria-label="Main navigation" to primary nav element
- 2026-03-25 [debt] Reduce excessive whitespace between landing page sections (hero→pricing ~200px gap)
- 2026-03-25 [feature] Use right half of landing page for visuals — hero, pricing, "what you get" sections are all left-aligned ~50% width
- 2026-03-25 [bug] CTA confusion: "Send your PRD" button vs "Email kahessay@icloud.com" in pricing card — unclear which path to take
- 2026-03-25 [bug] Showcase cards: last card ("Compliance Scan Service") clipped on desktop, no scroll indicator
- 2026-03-25 [debt] "Watch it build" CTA label is vague — clarify if it's a demo, video, or live build
- 2026-03-25 [bug] Pipeline activity log shows 3-day-old stuck CI failures (● running since Mar 22) — undermines trust
- 2026-03-25 [debt] Pricing cards are asymmetric heights/structure — equalize layout between $1 and $0 cards
- 2026-03-25 [debt] Monospace font overused for non-code text (section labels, disclaimers) — hurts scannability
- 2026-03-25 [debt] Page title is just "prd-to-prod" — add meta description for SEO and browser tabs
- 2026-03-25 [debt] "Platform Calgary" reference is unexplained in pricing section
- 2026-03-25 [bug] Touch targets too small — some CTAs are 31-34px height, WCAG recommends 44x44px minimum
- 2026-03-25 [debt] Verify focus indicators — ensure :focus-visible styles are present on all interactive elements
- 2026-03-25 [debt] "The New OSS" link goes to skahessay.dev without context — add brief attribution or host on prdtoprod.com
- 2026-03-25 [debt] Footer missing legal links (Privacy Policy, Terms of Service) — needed for paid product handling GitHub auth
- 2026-03-25 [debt] "BYOK" acronym used without definition — spell out on first use
- 2026-03-25 [debt] Scope box ("No mobile, no desktop") reads as a warning — reframe positively as "Optimized for web apps"
- 2026-03-25 [idea] Add social proof: quote from early adopter or direct link to Peli de Halleux repost
- 2026-03-25 [feature] Change font for prd-to-prod animation
- 2026-03-25 [feature] Template monitoring/alerts dashboard — surface failed workflow steps in-app instead of email spam

## Issued

## Done
