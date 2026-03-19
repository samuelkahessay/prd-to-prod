import fs from "fs";
import path from "path";

export interface ShowcaseApp {
  slug: string;
  run: number;
  name: string;
  tag: string;
  techStack: string;
  originalStack: string | null;
  date: string;
  prdPath: string;
  prdUrl: string;
  issueCount: number;
  prCount: number;
  description: string;
  linesAdded?: number;
  filesChanged?: number;
  testsWritten?: number;
  themes?: number;
}

const CURATED: Record<string, {
  slug: string;
  description: string;
  originalStack: string | null;
  linesAdded?: number;
  filesChanged?: number;
  testsWritten?: number;
  themes?: number;
}> = {
  "01-code-snippet-manager": {
    slug: "code-snippets",
    description: "Save, tag, and search code snippets with full-text search",
    originalStack: null,
  },
  "02-pipeline-observatory": {
    slug: "observatory",
    description: "Interactive pipeline visualizer with timeline replay and forensic inspection",
    originalStack: null,
    testsWritten: 32,
  },
  "03-devcard": {
    slug: "devcard",
    description: "GitHub profile card generator with 6 themes and PNG export",
    originalStack: null,
    themes: 6,
  },
  "04-ticket-deflection": {
    slug: "ticket-deflection",
    description: "Support ticket classifier that auto-resolves common issues and escalates complex cases",
    originalStack: "ASP.NET Core + C#",
    linesAdded: 3987,
    filesChanged: 119,
  },
  "05-compliance-scan": {
    slug: "compliance",
    description: "PIPEDA + FINTRAC regulatory scanner with auto-block and human escalation",
    originalStack: "ASP.NET Core + C#",
  },
};

const REPO = "https://github.com/samuelkahessay/prd-to-prod";

function resolveShowcaseDir(): string {
  // In Next.js (dev/build), process.cwd() is the repo root.
  // In Jest, process.cwd() is studio/. Use __dirname (studio/lib/) to navigate up.
  const fromCwd = path.resolve(process.cwd(), "showcase");
  if (fs.existsSync(fromCwd)) return fromCwd;
  // Fallback: resolve relative to this source file (studio/lib/ → ../../showcase)
  return path.resolve(__dirname, "../../showcase");
}

function loadShowcaseApps(): ShowcaseApp[] {
  const showcaseDir = resolveShowcaseDir();
  const dirs = Object.keys(CURATED);

  return dirs.map((dir) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(showcaseDir, dir, "manifest.json"), "utf-8")
    );
    const curated = CURATED[dir];
    return {
      slug: curated.slug,
      run: manifest.run.number,
      name: manifest.run.name,
      tag: manifest.run.tag,
      techStack: curated.originalStack ? "Next.js (showcase)" : manifest.run.tech_stack,
      originalStack: curated.originalStack,
      date: manifest.run.date,
      prdPath: manifest.run.prd,
      prdUrl: `${REPO}/blob/${manifest.run.tag}/${manifest.run.prd}`,
      issueCount: manifest.issues.length,
      prCount: manifest.pull_requests.length,
      description: curated.description,
      ...(curated.linesAdded && { linesAdded: curated.linesAdded }),
      ...(curated.filesChanged && { filesChanged: curated.filesChanged }),
      ...(curated.testsWritten && { testsWritten: curated.testsWritten }),
      ...(curated.themes && { themes: curated.themes }),
    };
  });
}

export const SHOWCASE_APPS: ShowcaseApp[] = loadShowcaseApps();

export function getShowcaseApp(slug: string): ShowcaseApp | undefined {
  return SHOWCASE_APPS.find((app) => app.slug === slug);
}
