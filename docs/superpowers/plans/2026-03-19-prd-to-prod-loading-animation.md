# PRD → prod Loading Animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable React component that animates the "o" dropping into "prd" to form "prod" with Pixar-style squash & stretch and ripple impact physics.

**Architecture:** Pure CSS `@keyframes` animation with CSS custom properties for tuning. Four separate keyframe definitions (one per letter). React component maps props to CSS variables. No animation libraries.

**Tech Stack:** React 19, TypeScript, CSS Modules, Next.js 16

**Spec:** `docs/superpowers/specs/2026-03-19-prd-to-prod-loading-animation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `web/components/shared/prd-to-prod-animation.tsx` | Create | React component: maps props to CSS variables, handles reduced motion, renders letter spans |
| `web/components/shared/prd-to-prod-animation.module.css` | Create | All keyframes (4), base styles, CSS variable defaults, reduced-motion media query |
| `web/test/prd-to-prod-animation.test.tsx` | Create | Unit tests: rendering, props, accessibility, reduced motion |

---

### Task 1: CSS Module — Base Styles and "o" Drop Keyframe

**Files:**
- Create: `web/components/shared/prd-to-prod-animation.module.css`

This task builds the CSS foundation: the container layout, letter styles, CSS variable defaults, and the primary "o" drop keyframe.

- [ ] **Step 0: Create the shared directory**

```bash
mkdir -p web/components/shared
```

- [ ] **Step 1: Create the CSS Module file with base styles**

```css
/* web/components/shared/prd-to-prod-animation.module.css */

.container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.letters {
  display: flex;
  align-items: baseline;
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--ink);
  letter-spacing: 0.05em;
  position: relative;

  /* Tunable axis defaults (medium amplitude) */
  --fall-distance: -70px;
  --squash-x: 1.3;
  --squash-y: 0.65;
  --hop-height: -6px;
  --hop-height-far: -4px;
  --rotation: 0deg;
  --rotation-neg: 0deg;
  --ripple-squash-x: 1;
  --ripple-squash-y: 1;
  --ripple-squash-x-inv: 1;
  --ripple-squash-y-inv: 1;
  --duration: 3.6s;
}

.letter {
  display: inline-block;
  transform-origin: center bottom;
  will-change: transform, opacity;
}

/* "d" starts shifted left to close the gap where "o" will appear */
.letterD {
  animation: shiftD var(--duration) ease infinite;
}

/* "o" starts hidden above */
.letterO {
  animation: dropO var(--duration) ease infinite;
}

/* "r" ripple — fires first on impact */
.letterR {
  animation: rippleR var(--duration) ease infinite;
}

/* "p" ripple — fires slightly after "r" */
.letterP {
  animation: rippleP var(--duration) ease infinite;
}
```

- [ ] **Step 2: Add the "o" drop keyframe**

Append to the same file:

```css
@keyframes dropO {
  0%, 22% {
    opacity: 0;
    transform:
      translateY(var(--fall-distance))
      scaleX(0.8)
      scaleY(1.3);
  }
  36% {
    opacity: 1;
    transform:
      translateY(2px)
      scaleX(var(--squash-x))
      scaleY(var(--squash-y));
  }
  43% {
    opacity: 1;
    transform:
      translateY(-6px)
      scaleX(0.88)
      scaleY(1.15);
  }
  50% {
    opacity: 1;
    transform:
      translateY(0)
      scaleX(1.05)
      scaleY(0.95);
  }
  56%, 80% {
    opacity: 1;
    transform:
      translateY(0)
      scaleX(1)
      scaleY(1);
  }
  92%, 100% {
    opacity: 0;
    transform:
      translateY(var(--fall-distance))
      scaleX(0.8)
      scaleY(1.3);
  }
}
```

- [ ] **Step 3: Add the "d" shift keyframe**

Append to the same file:

```css
@keyframes shiftD {
  0%, 22% {
    transform:
      translateX(-18px)
      translateY(0)
      scaleX(var(--ripple-squash-x-inv))
      scaleY(var(--ripple-squash-y-inv));
  }
  36% {
    transform:
      translateX(2px)
      translateY(-3px)
      scaleX(var(--ripple-squash-x))
      scaleY(var(--ripple-squash-y));
  }
  43% {
    transform:
      translateX(-1px)
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
      translateX(-18px)
      translateY(0)
      scaleX(var(--ripple-squash-x-inv))
      scaleY(var(--ripple-squash-y-inv));
  }
}
```

- [ ] **Step 4: Add the "r" and "p" ripple keyframes**

Append to the same file:

```css
@keyframes rippleR {
  0%, 35% {
    transform:
      translateY(0)
      rotate(0deg)
      scaleX(1)
      scaleY(1);
  }
  37% {
    transform:
      translateY(var(--hop-height))
      rotate(var(--rotation-neg))
      scaleX(var(--ripple-squash-x-inv))
      scaleY(var(--ripple-squash-y-inv));
  }
  40% {
    transform:
      translateY(1px)
      rotate(0deg)
      scaleX(var(--ripple-squash-x))
      scaleY(var(--ripple-squash-y));
  }
  45%, 100% {
    transform:
      translateY(0)
      rotate(0deg)
      scaleX(1)
      scaleY(1);
  }
}

@keyframes rippleP {
  0%, 37% {
    transform:
      translateY(0)
      rotate(0deg)
      scaleX(1)
      scaleY(1);
  }
  39.5% {
    transform:
      translateY(var(--hop-height-far))
      rotate(var(--rotation))
      scaleX(var(--ripple-squash-x-inv))
      scaleY(var(--ripple-squash-y-inv));
  }
  43% {
    transform:
      translateY(1px)
      rotate(0deg)
      scaleX(var(--ripple-squash-x))
      scaleY(var(--ripple-squash-y));
  }
  48%, 100% {
    transform:
      translateY(0)
      rotate(0deg)
      scaleX(1)
      scaleY(1);
  }
}
```

- [ ] **Step 5: Add reduced-motion and amplitude variants**

Append to the same file:

```css
/* Reduced motion: no animation, show static "prod" */
@media (prefers-reduced-motion: reduce) {
  .letterO {
    opacity: 1;
    animation: none;
    transform: none;
  }
  .letterD {
    animation: none;
    transform: none;
  }
  .letterR {
    animation: none;
    transform: none;
  }
  .letterP {
    animation: none;
    transform: none;
  }
}

/* Amplitude: tight */
.tight {
  --fall-distance: -55px;
  --squash-x: 1.2;
  --squash-y: 0.75;
  --hop-height: -4px;
  --hop-height-far: -3px;
}

/* Amplitude: full */
.full {
  --fall-distance: -85px;
  --squash-x: 1.4;
  --squash-y: 0.55;
  --hop-height: -8px;
  --hop-height-far: -6px;
}
```

- [ ] **Step 6: Commit**

```bash
cd web && git add components/shared/prd-to-prod-animation.module.css
git commit -m "feat: add CSS keyframes for prd-to-prod loading animation"
```

---

### Task 2: React Component

**Files:**
- Create: `web/components/shared/prd-to-prod-animation.tsx`

- [ ] **Step 1: Write the component**

```tsx
// web/components/shared/prd-to-prod-animation.tsx
"use client";

import { useMemo } from "react";
import styles from "./prd-to-prod-animation.module.css";

interface PrdToProdAnimationProps {
  /** Animation intensity — controls fall distance, squash, hop height */
  amplitude?: "tight" | "medium" | "full";
  /** Add organic tilt to ripple hops */
  rotation?: boolean;
  /** Propagate squash & stretch to all letters, not just the "o" */
  squashPropagation?: boolean;
  /** Font size in pixels */
  size?: number;
  /** Override cycle duration in seconds (min 2.5) */
  duration?: number;
}

export function PrdToProdAnimation({
  amplitude = "medium",
  rotation = false,
  squashPropagation = false,
  size = 48,
  duration = 3.6,
}: PrdToProdAnimationProps) {
  const clampedDuration = Math.max(2.5, duration);

  const cssVars = useMemo(() => {
    const vars: Record<string, string> = {
      "--duration": `${clampedDuration}s`,
      "--rotation": rotation ? "2deg" : "0deg",
      "--rotation-neg": rotation ? "-2deg" : "0deg",
    };

    if (squashPropagation) {
      vars["--ripple-squash-x"] = "1.1";
      vars["--ripple-squash-y"] = "0.88";
      vars["--ripple-squash-x-inv"] = "0.92";
      vars["--ripple-squash-y-inv"] = "1.1";
    }

    return vars;
  }, [clampedDuration, rotation, squashPropagation]);

  const amplitudeClass =
    amplitude === "tight"
      ? styles.tight
      : amplitude === "full"
        ? styles.full
        : undefined;

  return (
    <div
      className={styles.container}
      role="img"
      aria-label="prd to prod loading"
    >
      <div
        className={`${styles.letters} ${amplitudeClass ?? ""}`.trim()}
        style={{ fontSize: `${size}px`, ...cssVars } as React.CSSProperties}
      >
        <span className={`${styles.letter} ${styles.letterP}`}>p</span>
        <span className={`${styles.letter} ${styles.letterR}`}>r</span>
        <span className={`${styles.letter} ${styles.letterO}`}>o</span>
        <span className={`${styles.letter} ${styles.letterD}`}>d</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd web && npx next build 2>&1 | head -30`

Expected: No TypeScript or CSS errors.

- [ ] **Step 3: Commit**

```bash
cd web && git add components/shared/prd-to-prod-animation.tsx
git commit -m "feat: add PrdToProdAnimation React component"
```

---

### Task 3: Tests

**Files:**
- Create: `web/test/prd-to-prod-animation.test.tsx`

**Reference:** Tests follow the pattern in `web/test/components.test.tsx` — render with `@testing-library/react`, assert DOM structure and attributes. CSS Modules are mocked via `web/test/__mocks__/styleMock.ts` (returns class names as-is).

- [ ] **Step 1: Write the test file**

```tsx
// web/test/prd-to-prod-animation.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";

describe("PrdToProdAnimation", () => {
  it("renders all four letters in correct order", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    expect(container).toBeInTheDocument();
    expect(container.textContent).toBe("prod");
  });

  it("applies accessibility attributes", () => {
    render(<PrdToProdAnimation />);
    const el = screen.getByRole("img", { name: "prd to prod loading" });
    expect(el).toHaveAttribute("role", "img");
    expect(el).toHaveAttribute("aria-label", "prd to prod loading");
  });

  it("applies font size from size prop", () => {
    render(<PrdToProdAnimation size={24} />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.fontSize).toBe("24px");
  });

  it("clamps duration to minimum 2.5s", () => {
    render(<PrdToProdAnimation duration={1} />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--duration")).toBe("2.5s");
  });

  it("sets rotation CSS variables when rotation is true", () => {
    render(<PrdToProdAnimation rotation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--rotation")).toBe("2deg");
    expect(letters.style.getPropertyValue("--rotation-neg")).toBe("-2deg");
  });

  it("sets squash propagation CSS variables when enabled", () => {
    render(<PrdToProdAnimation squashPropagation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--ripple-squash-x")).toBe("1.1");
    expect(letters.style.getPropertyValue("--ripple-squash-y")).toBe("0.88");
  });

  it("does not set squash propagation vars by default", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--ripple-squash-x")).toBe("");
  });

  it("does not apply amplitude class for medium (default)", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.className).not.toContain("tight");
    expect(letters.className).not.toContain("full");
  });

  it("uses default duration of 3.6s", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--duration")).toBe("3.6s");
  });

  it("sets rotation to 0deg by default", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--rotation")).toBe("0deg");
    expect(letters.style.getPropertyValue("--rotation-neg")).toBe("0deg");
  });

  it("applies tight amplitude class", () => {
    render(<PrdToProdAnimation amplitude="tight" />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.className).toContain("tight");
  });

  it("applies full amplitude class", () => {
    render(<PrdToProdAnimation amplitude="full" />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.className).toContain("full");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd web && npx jest test/prd-to-prod-animation.test.tsx --verbose`

Expected: All 11 tests pass.

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `cd web && npm test`

Expected: All existing tests still pass.

- [ ] **Step 4: Commit**

```bash
cd web && git add test/prd-to-prod-animation.test.tsx
git commit -m "test: add PrdToProdAnimation unit tests"
```

---

### Task 4: Verify Visually

This task is manual verification — no code changes.

- [ ] **Step 1: Create a temporary test page to see the animation**

Create a temporary file `web/app/test-animation/page.tsx`:

```tsx
import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";

export default function TestPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px", padding: "48px", background: "#1a1a1a" }}>
      <div>
        <p style={{ color: "#999", marginBottom: "8px", fontFamily: "monospace" }}>medium (default)</p>
        <PrdToProdAnimation />
      </div>
      <div>
        <p style={{ color: "#999", marginBottom: "8px", fontFamily: "monospace" }}>tight</p>
        <PrdToProdAnimation amplitude="tight" />
      </div>
      <div>
        <p style={{ color: "#999", marginBottom: "8px", fontFamily: "monospace" }}>full + rotation + squash propagation</p>
        <PrdToProdAnimation amplitude="full" rotation squashPropagation />
      </div>
      <div>
        <p style={{ color: "#999", marginBottom: "8px", fontFamily: "monospace" }}>size=24, tight</p>
        <PrdToProdAnimation size={24} amplitude="tight" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

Run: `cd web && npm run dev`

Open: `http://localhost:3000/test-animation`

Verify:
- All four variants animate with visible squash & stretch
- The "o" drops in, "d" shifts, "r" and "p" ripple
- Medium/tight/full have noticeably different intensities
- Rotation variant shows letter tilt on hops
- Squash propagation variant shows deformation on all letters

- [ ] **Step 3: Delete the test page**

```bash
rm -rf web/app/test-animation
```

- [ ] **Step 4: Final commit with any tweaks**

If animation values needed tuning during visual review, commit the CSS changes:

```bash
cd web && git add -A && git commit -m "fix: tune animation values after visual review"
```

If no changes were needed, skip this step.
