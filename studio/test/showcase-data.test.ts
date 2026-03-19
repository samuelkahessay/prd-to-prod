import fs from "node:fs";
import path from "node:path";
import { SHOWCASE_APPS, formatShowcaseMonth, getShowcaseApp } from "@/lib/showcase-data";

describe("showcase-data", () => {
  it("has 5 apps", () => {
    expect(SHOWCASE_APPS).toHaveLength(5);
  });

  it("all apps have required fields derived from manifests", () => {
    for (const app of SHOWCASE_APPS) {
      expect(app.slug).toBeTruthy();
      expect(app.run).toBeGreaterThan(0);
      expect(app.name).toBeTruthy();
      expect(app.issueCount).toBeGreaterThan(0);
      expect(app.prCount).toBeGreaterThan(0);
      expect(app.prdUrl).toMatch(/^https:\/\/github\.com/);
    }
  });

  it("counts match actual manifest arrays", () => {
    const run01 = getShowcaseApp("code-snippets")!;
    expect(run01.issueCount).toBe(8);
    expect(run01.prCount).toBe(7);

    const run03 = getShowcaseApp("devcard")!;
    expect(run03.issueCount).toBe(18);
    expect(run03.prCount).toBe(28);
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

  it("preserves manifest name exactly", () => {
    expect(getShowcaseApp("compliance")?.name).toBe("Compliance Scan Service");
  });

  it("optional metrics only present when curated map has them", () => {
    const observatory = getShowcaseApp("observatory")!;
    expect(observatory.testsWritten).toBe(32);

    const snippets = getShowcaseApp("code-snippets")!;
    expect(snippets.linesAdded).toBeUndefined();
    expect(snippets.testsWritten).toBeUndefined();
  });

  it("preserves manifest tech stack exactly for native apps", () => {
    expect(getShowcaseApp("devcard")?.techStack).toBe("Next.js 14 + TypeScript + Framer Motion");
  });

  it("formats month-only dates without timezone drift", () => {
    expect(formatShowcaseMonth("2026-02")).toBe("Feb 2026");
    expect(formatShowcaseMonth("2026-03")).toBe("Mar 2026");
  });

  it("has gallery preview assets for each showcase app", () => {
    for (const app of SHOWCASE_APPS) {
      const previewFile = path.join(process.cwd(), "public", "showcase", `${app.slug}.png`);
      expect(fs.existsSync(previewFile)).toBe(true);
    }
  });
});
