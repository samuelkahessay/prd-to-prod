# Animation "prd" Initial Gap Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the visible gap between "pr" and "d" in the animation's initial state so it reads as "prd" (not "pr d"), and ensure the fix scales correctly across all font sizes.

**Architecture:** Convert the fixed-pixel `translateX(-18px)` in the `shiftD` keyframes to an `em`-based value. The invisible `o` element still occupies layout space (~0.6em character width + 0.05em letter-spacing), so `d` must shift left by that full amount. The small overshoot values at the impact keyframes (36%, 43%) are also converted to em for proportional scaling.

**Tech Stack:** CSS Modules (keyframe edit only), existing test suite

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `studio/components/shared/prd-to-prod-animation.module.css` | Modify | Change `translateX` values in `@keyframes shiftD` from px to em |
| `studio/test/prd-to-prod-animation.test.tsx` | No change | Existing tests cover rendering and props; this is a CSS-only change with no component logic changes |

---

## Root Cause

The DOM order is `p r o d`. When `o` is invisible (0%–22% of the cycle), it still occupies horizontal space in the flex layout. The `d` letter compensates with `translateX(-18px)`, but:

- In a monospace font, one character ≈ `0.6em` wide, plus `letter-spacing: 0.05em` = ~`0.65em`
- At `size=48` (default): `0.65em` ≈ 31px, but shift is only 18px → **13px gap**
- At `size=80` (animation page): `0.65em` ≈ 52px, but shift is only 18px → **34px gap**

The gap grows with font size because the shift is fixed pixels while the character width scales with em.

---

### Task 1: Fix shiftD Keyframes

**Files:**
- Modify: `studio/components/shared/prd-to-prod-animation.module.css:112-148` (`@keyframes shiftD`)

- [ ] **Step 1: Run existing tests to confirm green baseline**

Run: `cd studio && npx jest test/prd-to-prod-animation.test.tsx --verbose`
Expected: All 11 tests pass

- [ ] **Step 2: Update the shiftD keyframes**

Change `translateX(-18px)` to `translateX(-0.62em)` at the 0%/22% and 92%/100% keyframes. The `0.62em` value accounts for the monospace character width (~0.6em) plus letter-spacing (0.05em), minus a tiny optical gap (~0.03em) to prevent the `d` from visually colliding with `r`:

```css
@keyframes shiftD {
  0%, 22% {
    transform:
      translateX(-0.62em)
      translateY(0)
      scaleX(var(--ripple-squash-x-inv))
      scaleY(var(--ripple-squash-y-inv));
  }
  36% {
    transform:
      translateX(0.03em)
      translateY(-3px)
      scaleX(var(--ripple-squash-x))
      scaleY(var(--ripple-squash-y));
  }
  43% {
    transform:
      translateX(-0.02em)
      translateY(1px)
      scaleX(var(--ripple-squash-x-inv))
      scaleY(var(--ripple-squash-y-inv));
  }
  50%, 80% {
    transform:
      translateX(0)
      translateY(0)
      scaleX(1)
      scaleY(1);
  }
  92%, 100% {
    transform:
      translateX(-0.62em)
      translateY(0)
      scaleX(var(--ripple-squash-x-inv))
      scaleY(var(--ripple-squash-y-inv));
  }
}
```

Note: The overshoot values at 36% (`2px` → `0.03em`) and 43% (`-1px` → `-0.02em`) are also converted to em for consistency — these are the spring bounce when `d` settles into position.

- [ ] **Step 3: Run tests to confirm nothing broke**

Run: `cd studio && npx jest test/prd-to-prod-animation.test.tsx --verbose`
Expected: All 11 tests still pass (this is CSS-only, no component logic changed)

- [ ] **Step 4: Visual verification**

Run: `cd studio && npm run dev`
Open `http://localhost:3000/animation` and verify:
1. Initial state shows "prd" with no visible gap between "r" and "d"
2. The `o` drops in cleanly between `r` and `d`
3. `d` slides right smoothly to its final "prod" position
4. All 6 variants look correct (cycle through sidebar)
5. Specifically check that `size=80` (the animation page default) looks tight

- [ ] **Step 5: Tune the value if needed**

The `0.62em` value is a calculated estimate. If visual verification shows:
- Gap still visible → increase toward `0.65em`
- Letters overlapping → decrease toward `0.58em`

The correct value depends on the exact monospace font metrics. Adjust and re-verify.

- [ ] **Step 6: Commit**

```bash
git add studio/components/shared/prd-to-prod-animation.module.css
git commit -m "fix: close prd gap in animation initial state by using em-based translateX"
```
