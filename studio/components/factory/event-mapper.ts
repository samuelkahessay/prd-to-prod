import type { BuildEvent } from "@/lib/types";
import type { FactoryAction, WorkItem } from "./factory-types";

/**
 * Maps a BuildEvent from the SSE stream into zero or more FactoryActions
 * that drive the factory visualization state machine.
 */
export function mapBuildEvent(event: BuildEvent): FactoryAction[] {
  const actions: FactoryAction[] = [];
  const { category, kind, data } = event;
  const now = Date.now();

  // --- Provisioning events → Planner character ---

  if (category === "provision") {
    if (kind === "repo_creating") {
      actions.push({
        type: "AGENT_START_WORK",
        agent: "planner",
        task: "Creating repository",
      });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "busy" });
    }

    if (kind === "repo_created") {
      const repo = typeof data.repo === "string" ? data.repo : "";
      actions.push({
        type: "OUTPUT_UPDATE",
        fields: { repoUrl: typeof data.url === "string" ? data.url : null },
      });
      actions.push({
        type: "ITEM_ENTER",
        workstation: "blueprint-table",
        item: {
          id: `repo-${repo}`,
          type: "issue",
          label: repo,
          enteredAt: now,
        },
      });
    }

    if (kind === "prd_issue_created") {
      const issueNum = data.issueNumber;
      actions.push({
        type: "ITEM_ENTER",
        workstation: "blueprint-table",
        item: {
          id: `issue-${issueNum}`,
          type: "issue",
          label: `Issue #${issueNum}`,
          enteredAt: now,
        },
      });
      actions.push({
        type: "OUTPUT_UPDATE",
        fields: { issueCount: 1 },
      });
      actions.push({ type: "AGENT_FINISH_WORK", agent: "planner" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "planner" });
    }

    if (kind === "app_install_required") {
      actions.push({
        type: "AGENT_BLOCKED",
        agent: "planner",
        reason: "Waiting for GitHub App installation",
      });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "blocked" });
    }

    if (kind === "app_installed") {
      actions.push({ type: "AGENT_UNBLOCKED", agent: "planner" });
    }

    if (kind === "bootstrap_started") {
      actions.push({
        type: "AGENT_START_WORK",
        agent: "planner",
        task: "Bootstrapping repo",
      });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "busy" });
    }

    if (kind === "bootstrap_complete") {
      actions.push({ type: "AGENT_FINISH_WORK", agent: "planner" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "planner" });
    }
  }

  // --- Build events → Developer / Frontend Designer / Reviewer ---

  if (category === "build") {
    const agent = inferAgent(data);

    if (kind === "pipeline_started" || kind === "agent_started") {
      const detail =
        typeof data.detail === "string" ? data.detail : "Building";
      actions.push({
        type: "AGENT_START_WORK",
        agent,
        task: detail,
      });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "busy" });
    }

    if (kind === "pipeline_started") {
      actions.push({
        type: "ITEM_TRANSIT",
        from: "blueprint-table",
        to: "code-forge",
        item: {
          id: `brief-${event.id}`,
          type: "issue",
          label: "Work brief",
          enteredAt: now,
        },
      });
    }

    if (kind === "agent_progress") {
      // Keep the agent working, update task description
      const detail =
        typeof data.detail === "string" ? data.detail : "In progress";
      actions.push({
        type: "AGENT_START_WORK",
        agent,
        task: detail,
      });
    }

    if (kind === "pr_opened") {
      const prUrl = typeof data.pr_url === "string" ? data.pr_url : "";
      const prItem: WorkItem = {
        id: `pr-${prUrl}`,
        type: "pr",
        label: typeof data.pr_title === "string" ? data.pr_title : "PR",
        enteredAt: now,
      };

      // Move item from developer/designer to reviewer
      actions.push({
        type: "ITEM_TRANSIT",
        from: agent === "frontend-designer" ? "design-studio" : "code-forge",
        to: "inspection-bay",
        item: prItem,
      });
      actions.push({
        type: "AGENT_START_WORK",
        agent: "reviewer",
        task: "Reviewing pull request",
      });
      actions.push({
        type: "OUTPUT_UPDATE",
        fields: { prCount: (data.pr_count as number) || 1 },
      });
    }

    if (kind === "pr_reviewed") {
      actions.push({ type: "AGENT_FINISH_WORK", agent: "reviewer" });
    }

    if (kind === "pr_merged") {
      actions.push({ type: "AGENT_CELEBRATE", agent: "reviewer" });
    }

    if (kind === "agent_complete") {
      actions.push({ type: "AGENT_FINISH_WORK", agent });
      actions.push({ type: "AGENT_CELEBRATE", agent });
    }

    if (kind === "agent_error" || kind === "dispatch_error") {
      actions.push({
        type: "AGENT_BLOCKED",
        agent,
        reason: typeof data.detail === "string" ? data.detail : "Build error",
      });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "blocked" });
    }

    if (kind === "ci_passed") {
      // CI pass — move toward deployment
      actions.push({
        type: "ITEM_TRANSIT",
        from: "inspection-bay",
        to: "launch-pad",
        item: {
          id: `deploy-${event.id}`,
          type: "deployment",
          label: "Preview deploy",
          enteredAt: now,
        },
      });
      actions.push({
        type: "AGENT_START_WORK",
        agent: "deployer",
        task: "Deploying",
      });
    }

    if (kind === "ci_failed") {
      // CI fail — developer goes back to work
      actions.push({
        type: "AGENT_START_WORK",
        agent,
        task: "Fixing CI failure",
      });
    }

    if (
      kind === "pipeline_stalled" ||
      kind === "provider_retry_exhausted" ||
      kind === "capacity_waitlisted"
    ) {
      actions.push({
        type: "AGENT_BLOCKED",
        agent,
        reason: typeof data.detail === "string" ? data.detail : "Pipeline stalled",
      });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "blocked" });
    }
  }

  // --- Delivery events → Deployer ---

  if (category === "delivery") {
    if (kind === "deploying") {
      actions.push({
        type: "AGENT_START_WORK",
        agent: "deployer",
        task: "Deploying to preview",
      });
    }

    if (kind === "deploy_started") {
      actions.push({
        type: "AGENT_START_WORK",
        agent: "deployer",
        task: "Waiting for Vercel deployment",
      });
    }

    if (kind === "deployed") {
      actions.push({
        type: "OUTPUT_UPDATE",
        fields: {
          deployUrl:
            typeof data.deploy_url === "string" ? data.deploy_url : null,
        },
      });
    }

    if (kind === "complete") {
      actions.push({ type: "AGENT_FINISH_WORK", agent: "deployer" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "deployer" });
      // Celebrate across all agents
      actions.push({ type: "AGENT_CELEBRATE", agent: "planner" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "developer" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "frontend-designer" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "reviewer" });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "celebrating" });
      actions.push({
        type: "OUTPUT_UPDATE",
        fields: {
          deployUrl:
            typeof data.deploy_url === "string"
              ? data.deploy_url
              : null,
        },
      });
    }

    if (kind === "handoff_ready") {
      actions.push({ type: "AGENT_FINISH_WORK", agent: "deployer" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "deployer" });
      // Celebrate across all agents
      actions.push({ type: "AGENT_CELEBRATE", agent: "planner" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "developer" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "frontend-designer" });
      actions.push({ type: "AGENT_CELEBRATE", agent: "reviewer" });
      actions.push({ type: "AMBIENT_CHANGE", ambient: "celebrating" });
      actions.push({
        type: "OUTPUT_UPDATE",
        fields: {
          deployUrl:
            typeof data.deploy_url === "string"
              ? data.deploy_url
              : null,
        },
      });
    }
  }

  return actions;
}

/**
 * Infer which factory agent a build event maps to, based on the
 * data.agent field from the builder callback.
 */
function inferAgent(
  data: Record<string, unknown>
): "developer" | "frontend-designer" | "reviewer" {
  const agentName = typeof data.agent === "string" ? data.agent : "";

  if (agentName.includes("frontend")) return "frontend-designer";
  if (agentName.includes("review")) return "reviewer";
  return "developer";
}
