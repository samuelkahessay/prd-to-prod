import type {
  BuildEvent,
  BuildSession,
  BuildSessionStatus,
} from "@/lib/types";

export interface DemoProofStep {
  id: string;
  label: string;
  done: boolean;
}

export interface DemoProofFact {
  id: string;
  label: string;
  value: string;
  note: string;
  href?: string | null;
}

export interface DemoProofBeat {
  id: string;
  label: string;
  detail: string;
  href?: string | null;
}

export interface DemoProofSummary {
  facts: DemoProofFact[];
  trail: DemoProofBeat[];
  steps: DemoProofStep[];
}

const PROOF_TRAIL_ORDER = [
  "repo",
  "issue",
  "pr",
  "review",
  "merge",
  "checks",
  "deploy",
  "complete",
] as const;

export function deriveDemoProofSummary(
  session: BuildSession,
  events: BuildEvent[]
): DemoProofSummary {
  const issueCount = events.filter((event) => event.kind === "prd_issue_created").length;
  const prCount = derivePrCount(events);
  const repoCreated = findLatest(events, (event) => event.kind === "repo_created");
  const issueCreated = findLatest(events, (event) => event.kind === "prd_issue_created");
  const prOpened = findLatest(events, (event) => event.kind === "pr_opened");
  const prReviewed = findLatest(events, (event) => event.kind === "pr_reviewed");
  const prMerged = findLatest(events, (event) => event.kind === "pr_merged");
  const ciPassed = findLatest(events, (event) => event.kind === "ci_passed");
  const deployed = findLatest(
    events,
    (event) => event.kind === "deployed" || event.kind === "complete"
  );

  const repoUrl = session.github_repo_url || getString(repoCreated, "url");
  const deployUrl = session.deploy_url || getString(deployed, "deploy_url");
  const repoName = session.github_repo || getString(repoCreated, "repo") || "Provisioning...";
  const outputLabel = formatOutcome(session.status);

  const trailById = new Map<string, DemoProofBeat>();

  if (repoCreated) {
    trailById.set("repo", {
      id: "repo",
      label: "Repo provisioned",
      detail: repoName,
      href: repoUrl,
    });
  }

  if (issueCreated) {
    const issueNumber =
      typeof issueCreated.data.issueNumber === "number"
        ? `#${issueCreated.data.issueNumber}`
        : `${issueCount} issue${issueCount === 1 ? "" : "s"}`;
    trailById.set("issue", {
      id: "issue",
      label: "Root issue opened",
      detail: issueNumber,
    });
  }

  if (prOpened) {
    trailById.set("pr", {
      id: "pr",
      label: "PR opened",
      detail:
        getString(prOpened, "pr_title") || `${prCount} PR${prCount === 1 ? "" : "s"} opened`,
      href: getString(prOpened, "pr_url"),
    });
  }

  if (prReviewed) {
    trailById.set("review", {
      id: "review",
      label: "Review complete",
      detail: getString(prReviewed, "detail") || "PR review passed",
    });
  }

  if (prMerged) {
    trailById.set("merge", {
      id: "merge",
      label: "PR merged",
      detail: getString(prMerged, "detail") || "Merged to main",
    });
  }

  if (ciPassed) {
    trailById.set("checks", {
      id: "checks",
      label: "Checks green",
      detail: getString(ciPassed, "detail") || "CI passed on main",
    });
  }

  if (deployUrl || deployed) {
    trailById.set("deploy", {
      id: "deploy",
      label: deployUrl ? "Preview live" : "Output ready",
      detail: deployUrl ? formatLinkValue(deployUrl) : outputLabel,
      href: deployUrl,
    });
  }

  if (isTerminalStatus(session.status)) {
    trailById.set("complete", {
      id: "complete",
      label: "Build complete",
      detail: outputLabel,
      href: deployUrl,
    });
  }

  return {
    steps: [
      { id: "repo", label: "Repo provisioned", done: repoName !== "Provisioning..." },
      { id: "issue", label: "Root issue opened", done: issueCount > 0 },
      { id: "merge", label: "PR merged", done: Boolean(prMerged) },
      { id: "checks", label: "Checks green", done: Boolean(ciPassed) },
      {
        id: "output",
        label:
          session.status === "handoff_ready" && !deployUrl
            ? "Repo handoff ready"
            : "Output ready",
        done: isTerminalStatus(session.status),
      },
    ],
    facts: [
      {
        id: "repo",
        label: "Repo",
        value: repoName,
        note: repoUrl ? formatLinkValue(repoUrl) : "Awaiting repo URL",
        href: repoUrl,
      },
      {
        id: "output",
        label: "Output",
        value: deployUrl ? formatLinkValue(deployUrl) : outputLabel,
        note: deployUrl ? outputLabel : "Deployment proof optional in demo mode",
        href: deployUrl,
      },
      {
        id: "issues",
        label: "Issues",
        value: `${issueCount}`,
        note: issueCount === 1 ? "Root issue created" : "Tracked on the floor",
      },
      {
        id: "prs",
        label: "Pull requests",
        value: `${prCount}`,
        note: prCount === 1 ? "Merged through review" : "Counted from replay events",
      },
    ],
    trail: PROOF_TRAIL_ORDER.map((id) => trailById.get(id)).filter(
      (beat): beat is DemoProofBeat => Boolean(beat)
    ),
  };
}

export function formatOutcome(status: BuildSessionStatus): string {
  if (status === "complete") {
    return "Validated deploy";
  }

  if (status === "handoff_ready") {
    return "Repo handoff";
  }

  return "In progress";
}

export function isTerminalStatus(status: BuildSessionStatus): boolean {
  return status === "complete" || status === "handoff_ready";
}

function derivePrCount(events: BuildEvent[]): number {
  const latestPrCount = [...events]
    .reverse()
    .find((event) => event.kind === "pr_opened");

  if (typeof latestPrCount?.data?.pr_count === "number") {
    return latestPrCount.data.pr_count;
  }

  return events.filter((event) => event.kind === "pr_opened").length;
}

function findLatest(
  events: BuildEvent[],
  predicate: (event: BuildEvent) => boolean
): BuildEvent | null {
  return [...events].reverse().find(predicate) || null;
}

function getString(event: BuildEvent | null, key: string): string | null {
  if (!event) {
    return null;
  }

  const value = event.data[key];
  return typeof value === "string" ? value : null;
}

function formatLinkValue(value: string): string {
  return value.replace(/^https?:\/\//, "");
}
