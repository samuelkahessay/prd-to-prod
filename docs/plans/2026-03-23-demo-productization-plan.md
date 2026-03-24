# Demo Productization Plan

**Date:** 2026-03-23
**Status:** Draft
**Scope:** Close the gap between the current factory-floor build view and a polished demo product surface suitable for landing-page CTA, recorded video, and live walkthroughs.

---

## Goal

Turn the existing build visualization into a deliberate demo product:

1. A visitor can click into a demo flow and immediately understand that multiple agents are building software together.
2. The factory floor, not the final deployed app, carries the emotional weight of the demo.
3. The demo reliably plays as a cinematic 30-45 second sequence without depending on real pipeline wall-clock timing.
4. The deployed app remains visible at the end as proof, not as the primary spectacle.

---

## Current State

The repository already contains the core pieces:

- A dedicated factory-floor scene on the build status page
- Five distinct agents and five workstations
- Event-driven animation from build/provision/delivery events
- Reviewer walk-over behavior
- Center convergence, confetti, and `BUILD COMPLETE`
- Demo-mode build events that complete in about 21 seconds after build start

What is missing is productization:

- No dedicated fullscreen demo route or demo-first information architecture
- No time-compressed replay layer for completed runs
- Limited choreography beyond reviewer walk-over and final convergence
- No explicit cinematic scripting for the 45-second middle act
- Environment details are partly present but not fully animated through particles/behavior
- Competitive positioning copy currently risks overclaiming

---

## Product Decision

The demo surface should be treated as a **scripted replay product**, not a raw live pipeline monitor.

That means:

- Real build sessions still stream real events.
- Demo sessions use curated timing and replay pacing.
- Recorded video and first-run user experience should prefer the curated demo path.
- Real long-running builds can continue to use the same visual language, but should not define the demo rhythm.

This is the key decision that closes the gap. Without it, the visual layer is constrained by real pipeline duration, which is currently 60+ minutes for even the shortest archived real runs.

---

## Target Experience

### Demo script

1. `prd` to `prod` animation open
2. Paste PRD on `/build`
3. Immediate transition into fullscreen factory floor
4. 30-45 second choreographed agent sequence
5. Center convergence, confetti, `BUILD COMPLETE`
6. Quick proof cut to deployed app / repo / evidence
7. `prd` to `prod` animation close

### What must be visibly true

- Five agents feel active, distinct, and coordinated
- Work visibly moves between stations
- Reviews feel social, not only textual
- The room feels alive even between major events
- The celebration reads as earned, not decorative
- The final proof screen shows that the spectacle corresponds to a real repo/app outcome

---

## Non-Goals

- Do not redesign the real operator console around spectacle
- Do not fake successful real builds in non-demo mode
- Do not block self-serve hardening work on a perfect motion system
- Do not overclaim competitor limitations in public copy

---

## Workstreams

## 1. Demo Surface

Create a dedicated demo-first route and page composition.

**Required work**

- Add a dedicated route for the cinematic experience, likely `/demo` or `/build/demo`
- Keep `/build?demo=true` as a deep-link entry path, but land users in the dedicated presentation surface after PRD capture
- Reframe the current build detail page so demo and real build views are distinct modes, not one shared layout with a `Demo` pill
- Add a post-completion proof panel that can show deploy URL, repo URL, and one or two evidence artifacts

**Likely files**

- `studio/app/build/page.tsx`
- `studio/components/build/build-status.tsx`
- `studio/app/build/[id]/page.tsx`
- new demo route files under `studio/app/demo/` or `studio/app/build/demo/`

**Acceptance criteria**

- Demo mode reads as a product surface, not as an operator detail page with extra polish
- A viewer can watch the full sequence without needing to parse side panels or operational metadata

## 2. Replay and Time Compression

Introduce a replay engine that decouples demo pacing from event arrival time.

**Required work**

- Create a replay timeline format for demo sessions
- Allow the factory scene to consume either:
  - live SSE events
  - replay events with scheduled timestamps
- Build a pacing layer that stretches the current 21-second mock flow into a 30-45 second cinematic sequence
- Support pauses, anticipation beats, and denser action around PR review and merge moments
- Ensure completed runs can be replayed progressively instead of collapsing immediately into final state

**Likely files**

- `studio/components/factory/factory-scene.tsx`
- `studio/components/factory/event-mapper.ts`
- new replay utility under `studio/components/factory/` or `studio/lib/`
- potentially `console/lib/mock-services.js` if mock event emission needs richer demo beats

**Acceptance criteria**

- Demo playback duration is configurable
- Completed sessions can replay from start to finish
- The demo no longer depends on real run wall-clock timing

## 3. Choreography and Motion

Deepen agent-to-agent behavior so the room reads as coordinated work, not just state changes.

**Required work**

- Add more explicit movement states:
  - developer or designer stepping toward inspection when PR opens
  - reviewer receiving work in the inspection bay, then returning home
  - deployer becoming visibly active before final completion
- Add intermediate group behaviors before celebration so the ending does not jump straight from work to confetti
- Expand speech bubble vocabulary by event kind and task
- Add more ambient micro-actions during idle/between-event windows
- Add actual steam emission for the coffee machine or remove that claim from demo copy

**Likely files**

- `studio/components/factory/renderer-2d/factory-canvas.tsx`
- `studio/components/factory/renderer-2d/movement.ts`
- `studio/components/factory/renderer-2d/characters-v2.ts`
- `studio/components/factory/renderer-2d/environment.ts`
- `studio/components/factory/renderer-2d/particles.ts`
- `studio/components/factory/renderer-2d/idle-behaviors.ts`

**Acceptance criteria**

- At least three distinct cross-room motion moments occur before final convergence
- Review reads like a social interaction, not only a badge change
- Ambient room details are visible in motion during the sequence

## 4. Narrative and Copy

Change the surrounding story so the visual system is positioned accurately and strongly.

**Required work**

- Replace "they all show logs and terminal output" with a more defensible comparison
- Position the differentiator as "live isometric multi-agent factory-floor visualization"
- Update CTA copy to reflect the actual demo experience
- Ensure any reference to steam/coffee particles matches the implementation
- Treat deployed app as proof of completion, not the climax

**Likely files**

- landing page components under `studio/components/landing/`
- build/demo CTA copy in `studio/app/page.tsx` and related landing components
- supporting docs if public-facing repo copy is updated

**Acceptance criteria**

- Public copy is strong without relying on brittle competitor claims
- The promise of the demo matches what the product actually shows

## 5. Evidence and Endcap

Make the "proof it is real" ending fast and credible.

**Required work**

- Add a compact end state that shows:
  - deploy URL or handoff-ready state
  - repo reference
  - PR count / issue count
  - one evidence cue such as merged PR or deployment validation
- Keep this segment under 5-8 seconds in the recorded script
- Ensure demo mode can always resolve to a clean proof state

**Likely files**

- `studio/components/build/build-status.tsx`
- `studio/components/factory/factory-hud.tsx`
- possibly new shared proof/evidence component

**Acceptance criteria**

- The viewer leaves with proof that the animation corresponds to a real software-delivery outcome

## 6. Validation

Demo polish must be tested as a product, not only as a component.

**Required work**

- Add an end-to-end demo smoke path:
  - open demo flow
  - start demo session
  - verify replay starts
  - verify celebration appears
  - verify proof state appears
- Add reduced-motion verification
- Capture one or more canonical screenshots for reuse in social and landing surfaces
- Optionally add a recordable "demo mode" preset for a consistent filmed sequence

**Likely files**

- e2e tests under `console/test/` or `studio/test/` depending on current pattern
- screenshot capture utility or documented manual flow

**Acceptance criteria**

- The demo is reproducible for recordings and stakeholder walkthroughs
- The happy path does not depend on manual operator intervention

---

## Execution Phases

## Phase 0: Narrative Lock

**Outcome:** One agreed demo script and one agreed claim set

- Finalize the 7-step demo script
- Approve safe positioning language
- Decide the canonical entry route for the demo

**Estimate:** 0.5 day

## Phase 1: Demo Route + Replay Engine

**Outcome:** A dedicated demo surface with replay pacing

- Add the demo route
- Build replay scheduling
- Separate demo layout from real build detail layout

**Estimate:** 2-3 days

## Phase 2: Choreography Pass

**Outcome:** The room feels alive and coordinated

- Add explicit motion beats
- Expand ambient actions and speech bubbles
- Wire coffee-machine steam if it stays in the promise

**Estimate:** 2-4 days

## Phase 3: Proof Endcap + Capture

**Outcome:** Demo closes with fast, credible proof and reusable assets

- Add proof endcap
- Add smoke coverage
- Capture canonical screenshots/video sequence

**Estimate:** 1-2 days

## Phase 4: Landing Integration

**Outcome:** The landing page pushes visitors into the productized demo path

- Update CTA destinations
- Align copy across landing and build surfaces
- Reuse captured assets on landing/social surfaces

**Estimate:** 1 day

## Queued Follow-Up

The core demo product is already there. The remaining productization work is:

- Change landing CTAs to push the demo-first path instead of the old submit-first path
- Align copy so it matches the actual productized flow instead of the older "$1 deployed app" and email-first framing
- Reuse the captured factory-floor and proof stills on the landing surface
- Decide and implement the canonical public demo entry instead of relying on `/build?demo=true`

Recommended hardening:

- Add a committed browser-level end-to-end smoke test for the full demo path
- Add a deterministic recording preset for repeatable filmed takes

---

## Recommended File Map

| File / Area | Action | Purpose |
|---|---|---|
| `studio/components/build/build-status.tsx` | Modify | Split demo presentation from real run detail |
| `studio/components/factory/factory-scene.tsx` | Modify | Support replay pacing, not only immediate reduction |
| `studio/components/factory/event-mapper.ts` | Modify | Expand beat mapping and event-to-motion semantics |
| `studio/components/factory/renderer-2d/factory-canvas.tsx` | Modify | Add choreography triggers and presentation polish |
| `studio/components/factory/renderer-2d/movement.ts` | Modify | Support richer multi-stop motion behavior |
| `studio/components/factory/renderer-2d/environment.ts` | Modify | Increase room liveliness, coffee-machine presentation |
| `studio/components/factory/renderer-2d/particles.ts` | Modify | Add emitted steam or other ambient particles |
| `console/lib/mock-services.js` | Modify | Provide richer demo beats when using demo mode |
| `studio/app/build/page.tsx` | Modify | Route demo users into the productized demo flow |
| `studio/app/demo/*` or similar | Add | Dedicated cinematic demo surface |

---

## Success Criteria

The work is complete when all of the following are true:

- A first-time visitor can run a demo and understand the product without reading technical docs
- The factory floor occupies the main emotional beat of the experience
- Demo playback consistently lands in the 30-45 second range
- The ending proves repo/app reality in under 8 seconds
- Public claims about the demo are fully supported by the implementation
- The demo is stable enough to use for recorded marketing assets and live sharing

---

## Recommended Next Step

Start with **Phase 1**, not the choreography pass.

The highest-leverage sequence is:

1. lock the demo route
2. add replay/time compression
3. then deepen motion

Without replay control, any motion polish is still trapped inside the wrong pacing model.
