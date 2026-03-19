# PRD → prod Loading Animation

## Overview

A loading animation built on the wordplay in the product name: "prd" becomes "prod" when the letter "o" drops in. The animation uses Pixar-style squash & stretch physics with a ripple impact — each letter reacts independently to the "o" arriving, creating a chain reaction that mirrors what the pipeline itself does.

## Core Concept

The product name *is* the animation. `prd` → `prod` is a single letter insertion, and the "to" in "prd-to-prod" describes the transformation itself.

### Animation Sequence

1. **Start state:** "prd" displayed — the "o" is hidden, "d" is shifted left to close the gap
2. **Drop:** The "o" falls from above with squash & stretch — elongated vertically on the way down (`scaleX(0.8) scaleY(1.3)`)
3. **Impact:** The "o" squashes wide on contact (`scaleX(1.3) scaleY(0.65)`), then rebounds through a stretch-squash-settle sequence
4. **Ripple:** On impact, a shockwave propagates outward:
   - "r" reacts first (closest to impact)
   - "p" reacts ~60ms later (ripple reaches it)
   - "d" shifts right to make room, overshoots slightly, settles
5. **Hold:** Word reads "prod" — holds for ~1 second
6. **Reset:** "o" fades out and rises, "d" shifts back, loop restarts

### Three Tunable Axes

The animation is designed as a configurable skeleton:

| Axis | What it controls | Low | High |
|------|-----------------|-----|------|
| **Amplitude** | Fall distance, squash intensity, hop height | `-55px` fall, `scaleY(0.75)` squash, `4px` hops | `-70px` fall, `scaleY(0.65)` squash, `8px` hops |
| **Rotation** | Tilt on ripple hops | `0deg` (mechanical) | `±2deg` (organic, bobbing) |
| **Squash propagation** | Whether reaction letters also deform | Hops only (`translateY`) | Full squash & stretch on every letter |

These axes are independent and composable via component props.

## Technical Design

### Component API

```tsx
// studio/components/shared/prd-to-prod-animation.tsx

interface PrdToProdAnimationProps {
  /** Animation intensity — controls fall distance, squash, hop height */
  amplitude?: 'tight' | 'medium' | 'full'
  /** Add organic tilt to ripple hops */
  rotation?: boolean
  /** Propagate squash & stretch to all letters, not just the "o" */
  squashPropagation?: boolean
  /** Font size in pixels — animation values scale proportionally */
  size?: number
  /** Override cycle duration in seconds */
  duration?: number
}
```

Default: `amplitude="medium"`, `rotation={false}`, `squashPropagation={false}`, `size={48}`, `duration={3.6}`.

### Implementation Approach

- **Pure CSS `@keyframes`** — no animation libraries. Matches the existing codebase (all hand-rolled animations, no framer-motion/GSAP).
- **CSS Modules** — `prd-to-prod-animation.module.css` with scoped class names, consistent with `studio/` patterns.
- **HTML structure:** Each letter is an `inline-block <span>` inside a flex container. The "o" is hidden via `opacity: 0` + `translateY(off-screen)`, not `width: 0` — this keeps all animation on compositor-friendly properties (`transform`, `opacity`) and avoids layout reflow. The "d" uses `translateX(-18px)` to close the gap in the start state, then animates to `translateX(0)` to make room.
- **`transform-origin: center bottom`** on all letters so squash deformation anchors at the text baseline, not the center.
- **`will-change: transform, opacity`** on each animated span to promote to compositor layers for smooth 60fps looping.
- **Four separate `@keyframes` definitions** — one per letter ("o" drop, "d" shift, "r" ripple, "p" ripple). Each letter needs its own keyframes because the ripple timing offsets are baked into the percentage values, not achievable via `animation-delay` on a shared keyframe.
- **CSS custom properties** for the amplitude and rotation axes — the React component sets `--fall-distance`, `--squash-x`, `--squash-y`, `--hop-height`, `--rotation` as CSS variables on the container, and the keyframes reference them via `var()`. All keyframe steps use an identical transform function list (same number and type of functions in the same order) so the browser can interpolate smoothly between them.
- **Squash propagation axis** uses an identity-transform approach: the ripple keyframes for "r" and "p" always include `scaleX()` and `scaleY()` in their transform list, set to `scale(1)` when propagation is off. This keeps the transform function list identical across both modes, allowing a single set of keyframes to handle both. The component sets `--ripple-squash-x` and `--ripple-squash-y` custom properties (`1` when off, actual deformation values when on).
- **`prefers-reduced-motion`** — when the user prefers reduced motion, render static "prod" text with no animation. The codebase already has a global rule in `globals.css` that kills animation durations, but the component-level query additionally controls content (showing "prod" not "prd") and prevents a flash of the start state.
- **Minimum duration:** The `duration` prop is clamped to a floor of 2.5s to prevent the physics looking unnatural at very fast cycle times.

### File Structure

```
studio/components/shared/
  prd-to-prod-animation.tsx          # React component
  prd-to-prod-animation.module.css   # Keyframes + styles
```

`shared/` is a new directory — this component is designed to be used across landing, build, and console surfaces.

### Animation Values (medium amplitude, reference)

```css
/* "o" drop */
0%, 22%   → opacity: 0; translateY(-70px) scaleX(0.8) scaleY(1.3)
36%       → opacity: 1; translateY(2px) scaleX(1.3) scaleY(0.65)   /* impact */
43%       → translateY(-6px) scaleX(0.88) scaleY(1.15)             /* rebound */
50%       → translateY(0) scaleX(1.05) scaleY(0.95)                /* settle */
56%-80%   → translateY(0) scaleX(1) scaleY(1)                      /* hold */
92%-100%  → opacity: 0; translateY(-70px)                           /* reset */

/* "d" shift */
0%, 22%   → translateX(-18px)
36%       → translateX(2px) translateY(-3px)   /* overshoot */
50%-80%   → translateX(0)                       /* settled */

/* "r" ripple (fires at 35%) */
37%       → translateY(-6px)
42%       → translateY(1px)
47%       → translateY(0)

/* "p" ripple (fires at 37%, delayed) */
39.5%     → translateY(-4px)
44%       → translateY(1px)
49%       → translateY(0)
```

## Initial Use: Loading State

The first integration point is as a loading indicator, replacing or supplementing any existing loading states in the build flow. The component renders at a size appropriate for inline or centered loading contexts.

Future use cases (not in scope for initial implementation):
- Hero animation on landing page
- Logo mark / brand element
- Page transition between build stages

## Accessibility

- `prefers-reduced-motion: reduce` → static "prod" text, no animation
- `role="img"` with `aria-label="prd to prod loading"` on the container
- No flashing or strobing — smooth continuous motion only

## Scope

**In scope:**
- React component with CSS Module animations
- Three configurable axes via props
- Reduced motion support
- Shared component location

**Out of scope:**
- Integration into specific pages (separate task)
- Canvas-based rendering (CSS is sufficient for this)
- Sound effects
- Color transitions or gradient effects
