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

const REPO = "https://github.com/samuelkahessay/prd-to-prod";
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// Embedded snapshot of showcase/*/manifest.json to avoid fs reads in shared modules.
// Curated fields (slug, description, originalStack, extra metrics) are added manually.
export const SHOWCASE_APPS: ShowcaseApp[] = [
  {
    slug: "code-snippets",
    run: 1,
    name: "Code Snippet Manager",
    tag: "v1.0.0",
    techStack: "Express + TypeScript",
    originalStack: null,
    date: "2026-02",
    prdPath: "docs/prd/sample-prd.md",
    prdUrl: `${REPO}/blob/v1.0.0/docs/prd/sample-prd.md`,
    issueCount: 8,
    prCount: 7,
    description: "Save, tag, and search code snippets with full-text search",
  },
  {
    slug: "observatory",
    run: 2,
    name: "Pipeline Observatory",
    tag: "v2.0.0",
    techStack: "Next.js 14 + TypeScript",
    originalStack: null,
    date: "2026-02",
    prdPath: "docs/prd/pipeline-observatory-prd.md",
    prdUrl: `${REPO}/blob/v2.0.0/docs/prd/pipeline-observatory-prd.md`,
    issueCount: 12,
    prCount: 14,
    description: "Interactive pipeline visualizer with timeline replay and forensic inspection",
    testsWritten: 32,
  },
  {
    slug: "devcard",
    run: 3,
    name: "DevCard",
    tag: "v3.0.0",
    techStack: "Next.js 14 + TypeScript + Framer Motion",
    originalStack: null,
    date: "2026-02",
    prdPath: "docs/prd/devcard-prd.md",
    prdUrl: `${REPO}/blob/v3.0.0/docs/prd/devcard-prd.md`,
    issueCount: 18,
    prCount: 28,
    description: "GitHub profile card generator with 6 themes and PNG export",
    themes: 6,
  },
  {
    slug: "ticket-deflection",
    run: 4,
    name: "Ticket Deflection",
    tag: "v4.0.0",
    techStack: "ASP.NET Core + C#",
    originalStack: "ASP.NET Core + C#",
    date: "2026-02",
    prdPath: "docs/prd/ticket-deflection-prd.md",
    prdUrl: `${REPO}/blob/v4.0.0/docs/prd/ticket-deflection-prd.md`,
    issueCount: 52,
    prCount: 37,
    description: "Support ticket classifier that auto-resolves common issues and escalates complex cases",
    linesAdded: 3987,
    filesChanged: 119,
  },
  {
    slug: "compliance",
    run: 5,
    name: "Compliance Scan Service",
    tag: "v5.0.0",
    techStack: "ASP.NET Core + C#",
    originalStack: "ASP.NET Core + C#",
    date: "2026-03",
    prdPath: "docs/prd/run-07-compliance-scan-service-prd.md",
    prdUrl: `${REPO}/blob/v5.0.0/docs/prd/run-07-compliance-scan-service-prd.md`,
    issueCount: 8,
    prCount: 8,
    description: "PIPEDA + FINTRAC regulatory scanner with auto-block and human escalation",
  },
];

export function getShowcaseApp(slug: string): ShowcaseApp | undefined {
  return SHOWCASE_APPS.find((app) => app.slug === slug);
}

export function formatShowcaseMonth(dateStr: string): string {
  const [yearPart, monthPart] = dateStr.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return dateStr;
  }

  return `${MONTH_LABELS[month - 1]} ${year}`;
}
