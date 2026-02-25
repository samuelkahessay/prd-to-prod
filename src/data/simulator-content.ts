export interface NodeContent {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  outputs: string[];
  techDetail: string;
}

export const SIMULATOR_CONTENT: NodeContent[] = [
  {
    id: "decomposer",
    name: "PRD Decomposer",
    description:
      "Reads Product Requirements Documents and breaks them down into actionable GitHub Issues with acceptance criteria and dependencies.",
    triggers: [
      "PRD pushed to docs/prd/",
      "/decompose command on a PR or issue",
    ],
    outputs: [
      "GitHub Issues with [Pipeline] prefix",
      "Acceptance criteria per issue",
      "Dependency links (Depends on #N)",
      "Type labels: feature, test, infra, docs",
    ],
    techDetail:
      "Uses AI to parse PRD prose and generate structured issues via the GitHub API. Runs as a GitHub Actions workflow on push/command.",
  },
  {
    id: "assist",
    name: "Repo Assist",
    description:
      "Picks up implementable issues in dependency order, writes the code, and opens draft pull requests targeting main.",
    triggers: [
      "Daily schedule (cron)",
      "/repo-assist command",
      "Workflow dispatch after PR merge",
    ],
    outputs: [
      "Feature branches (repo-assist/issue-N-*)",
      "Draft pull requests with Closes #N",
      "Passing test suite",
    ],
    techDetail:
      "Runs in a sandboxed container with npm and git access. Reads AGENTS.md for project-specific coding standards before each implementation.",
  },
  {
    id: "reviewer",
    name: "PR Reviewer",
    description:
      "Automatically reviews pipeline pull requests, approves clean PRs, and requests changes on failing ones.",
    triggers: [
      "PR opened",
      "PR synchronized (new commits pushed)",
    ],
    outputs: [
      "Approval or change-request review",
      "Inline code comments",
      "Auto-merge enabled on approval",
    ],
    techDetail:
      "Checks test results, reviews diff quality, enforces AGENTS.md coding standards, and enables GitHub auto-merge when the PR is approved.",
  },
  {
    id: "merge",
    name: "Auto-Merge",
    description:
      "Merges approved pull requests and re-dispatches the pipeline to pick up newly unblocked issues.",
    triggers: [
      "PR review approval",
      "All required CI checks pass",
    ],
    outputs: [
      "Merged commits to main",
      "Issues closed via Closes #N",
      "Dispatch to Repo Assist for next issue",
    ],
    techDetail:
      "GitHub built-in auto-merge configured by the PR reviewer. Issues auto-close via the Closes keyword in PR body; the merge event triggers the next pipeline cycle.",
  },
];
