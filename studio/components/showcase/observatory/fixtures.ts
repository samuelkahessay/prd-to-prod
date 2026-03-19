// ── Pipeline Nodes ─────────────────────────────────────────────────────────

export interface PipelineNode {
  id: string;
  label: string;
  description: string;
  triggers: string[];
  outputs: string[];
  status: "active" | "idle";
}

export const PIPELINE_NODES: PipelineNode[] = [
  {
    id: "decompose",
    label: "Decompose",
    description:
      "Reads the PRD issue and breaks it into discrete, implementable child issues. Each child issue maps to one feature with acceptance criteria the build agent can verify.",
    triggers: ["Issue labeled pipeline", "PRD issue body"],
    outputs: ["Child issues (one per feature)", "Labels: pipeline, feature"],
    status: "active",
  },
  {
    id: "build",
    label: "Build",
    description:
      "Picks up the next open pipeline issue, reads the repo context, and writes the implementation. Opens a PR against main with passing tests.",
    triggers: ["Open pipeline issue", "Repo memory checkpoint"],
    outputs: ["Pull request with code", "Test results", "PR description"],
    status: "active",
  },
  {
    id: "review",
    label: "Review",
    description:
      "Reviews the PR against the acceptance criteria in the linked issue. Approves if all criteria pass; requests changes with a specific remediation plan if not.",
    triggers: ["PR opened with pipeline label", "Linked issue criteria"],
    outputs: ["Review decision (APPROVE / REQUEST_CHANGES)", "Review body"],
    status: "active",
  },
  {
    id: "gate",
    label: "Gate",
    description:
      "Human decision point. Compliance-affecting changes are blocked here until an operator approves via the console. Non-compliance PRs auto-advance.",
    triggers: ["Approved review", "Autonomy policy glob match"],
    outputs: ["Operator decision (Approved/Rejected)", "Audit log entry"],
    status: "idle",
  },
  {
    id: "ship",
    label: "Ship",
    description:
      "Squash-merges the approved PR, closes the linked issue, and triggers a Vercel deploy. The pipeline then picks up the next open issue.",
    triggers: ["Operator approval or policy pass-through", "CI green"],
    outputs: ["Merged commit", "Closed issue", "Deploy URL"],
    status: "idle",
  },
];

// ── Timeline Events (Run 02 — Pipeline Observatory) ────────────────────────

export interface TimelineEvent {
  id: string;
  type: "issue" | "pr" | "merge" | "ci";
  title: string;
  timestamp: string;
  details: string;
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "evt-01",
    type: "issue",
    title: "PRD: Pipeline Observatory",
    timestamp: "2026-02-25T07:46:26Z",
    details:
      "Human opened PRD issue #29 with full feature spec for the Observatory app. Labeled `pipeline` — PRD Decomposer picked it up immediately.",
  },
  {
    id: "evt-02",
    type: "issue",
    title: "[Pipeline] Project Scaffold — Next.js 14, TypeScript, Tailwind, Vitest",
    timestamp: "2026-02-25T07:52:25Z",
    details:
      "Decomposer created child issue #30. Bootstraps the Next.js 14 App Router project with all required tooling. No dependencies.",
  },
  {
    id: "evt-03",
    type: "issue",
    title: "[Pipeline] Static Fixture Data & Data Loading Layer",
    timestamp: "2026-02-25T07:52:26Z",
    details:
      "Decomposer created child issue #31. Bundles real pipeline run data as static JSON and creates a data loading layer with GitHub API fallback.",
  },
  {
    id: "evt-04",
    type: "issue",
    title: "[Pipeline] Navigation Bar and Landing Page",
    timestamp: "2026-02-25T07:52:28Z",
    details:
      "Decomposer created child issue #32. Shared sticky nav bar and landing page with hero section, three view cards, and live stats.",
  },
  {
    id: "evt-05",
    type: "pr",
    title: "PR #40: Project Scaffold — Next.js 14, TypeScript, Tailwind, Vitest",
    timestamp: "2026-02-25T08:14:37Z",
    details:
      "Repo-assist opened PR #40. Includes package.json, tsconfig.json, Tailwind config, root layout with dark theme, and placeholder home page. 6 Vitest tests passing.",
  },
  {
    id: "evt-06",
    type: "merge",
    title: "Merged PR #40: Project Scaffold",
    timestamp: "2026-02-25T13:17:52Z",
    details:
      "PR #40 approved by PR reviewer (APPROVED) and auto-merged. 1,847 lines added. Issue #30 closed. Vercel preview deployed.",
  },
  {
    id: "evt-07",
    type: "pr",
    title: "PR #42: Static Fixture Data & Data Loading Layer",
    timestamp: "2026-02-25T13:41:02Z",
    details:
      "Repo-assist opened PR #42. Includes issues.json, pull-requests.json, workflow-runs.json fixtures and a data loading layer with API fallback. 8 unit tests.",
  },
  {
    id: "evt-08",
    type: "ci",
    title: "CI failure: TypeScript strict-mode error in github.ts",
    timestamp: "2026-02-25T13:58:44Z",
    details:
      "Octokit response types not fully mapped — `any` leaked into strict mode. Build failed. PR reviewer requested changes with specific type fix.",
  },
  {
    id: "evt-09",
    type: "pr",
    title: "PR #47: Simulator — Interactive SVG Node Graph",
    timestamp: "2026-02-25T14:22:51Z",
    details:
      "Repo-assist opened PR #47 after scaffold and fixture PRs merged. SVG node graph with 4 pipeline stages, click-to-activate chain, Framer Motion animations, speed control.",
  },
  {
    id: "evt-10",
    type: "merge",
    title: "Merged PR #47: Interactive SVG Node Graph",
    timestamp: "2026-02-25T16:09:33Z",
    details:
      "PR #47 approved and merged. 2,103 lines added across pipeline-graph.tsx and related components. Issue #33 closed. Simulator view live on Vercel preview.",
  },
];

// ── CI Failure Events ──────────────────────────────────────────────────────

export interface FailureEvent {
  id: string;
  severity: "high" | "medium" | "low";
  error: string;
  resolution: string;
  pr: string;
  category: "workflow" | "config" | "api" | "race-condition";
}

export const FAILURE_EVENTS: FailureEvent[] = [
  {
    id: "fail-01",
    severity: "high",
    error:
      "Shell injection: PR body content with spaces reached `echo \"$VAR\" | grep` in close-issues workflow, causing word-splitting failures that silently closed the wrong issues.",
    resolution:
      "Replaced shell variable interpolation with `gh --jq 'scan()'` so PR body content never touches a shell variable. Applied same fix to pr-reviewer and pipeline-watchdog.",
    pr: "PR #54",
    category: "workflow",
  },
  {
    id: "fail-02",
    severity: "high",
    error:
      "PR reviewer dispatch leaked review summary into shell via `echo \"$REVIEW_BODY\"`. Multi-line AI output caused bash syntax errors that crashed the reviewer job.",
    resolution:
      "Switched to heredoc-style output (`cat <<'EOF'`) and passed review body through GitHub step summary instead of environment variable. No shell interpolation of AI output.",
    pr: "PR #55",
    category: "workflow",
  },
  {
    id: "fail-03",
    severity: "medium",
    error:
      "Simulator graph scaling broke on viewports below 768px — SVG fixed-width overflow caused horizontal scroll and clipped node labels.",
    resolution:
      "Added `preserveAspectRatio='xMidYMid meet'` and responsive `width='100%'` to the SVG element. Graph now scales within its container via viewBox.",
    pr: "PR #58",
    category: "config",
  },
  {
    id: "fail-04",
    severity: "low",
    error:
      "Concurrency group collision: `close-issues` workflow shared the same group key as `pr-reviewer`, so a slow review run would cancel the issue-closing job on PR merge.",
    resolution:
      "Gave close-issues its own concurrency group `close-issues-${{ github.event.pull_request.number }}` isolated from the reviewer group.",
    pr: "PR #56",
    category: "race-condition",
  },
];
