import type {
  BuildEvent,
  BuildSession,
  BuildSessionStatus,
} from "./types";

const SESSION_STATUS_RANK: Record<BuildSessionStatus, number> = {
  refining: 0,
  ready: 1,
  awaiting_install: 2,
  bootstrapping: 3,
  ready_to_launch: 4,
  awaiting_capacity: 5,
  building: 6,
  handoff_ready: 7,
  complete: 8,
  stalled: 8,
  failed: 8,
};

export function appendUniqueEvent(
  events: BuildEvent[],
  nextEvent: BuildEvent
): BuildEvent[] {
  if (events.some((event) => event.id === nextEvent.id)) {
    return events;
  }

  return [...events, nextEvent];
}

export function mergeUniqueEvents(
  events: BuildEvent[],
  nextEvents: BuildEvent[]
): BuildEvent[] {
  let merged = events;

  for (const nextEvent of nextEvents) {
    merged = appendUniqueEvent(merged, nextEvent);
  }

  return merged;
}

export function reconcileSessionSnapshot(
  session: BuildSession,
  nextSession: BuildSession
): BuildSession {
  const currentUpdatedAt = Date.parse(session.updated_at || "");
  const nextUpdatedAt = Date.parse(nextSession.updated_at || "");

  if (
    Number.isFinite(currentUpdatedAt) &&
    Number.isFinite(nextUpdatedAt) &&
    nextUpdatedAt > currentUpdatedAt
  ) {
    return nextSession;
  }

  if (SESSION_STATUS_RANK[nextSession.status] >= SESSION_STATUS_RANK[session.status]) {
    return {
      ...session,
      ...nextSession,
    };
  }

  return {
    ...session,
    github_repo: nextSession.github_repo || session.github_repo,
    github_repo_id: nextSession.github_repo_id ?? session.github_repo_id,
    github_repo_url: nextSession.github_repo_url || session.github_repo_url,
    deploy_url: nextSession.deploy_url || session.deploy_url,
    prd_final: nextSession.prd_final || session.prd_final,
    app_installation_id:
      nextSession.app_installation_id ?? session.app_installation_id,
  };
}

export function applyEventToSession(
  session: BuildSession,
  event: BuildEvent
): BuildSession {
  if (session.status === "complete") {
    return session;
  }

  if (session.status === "handoff_ready") {
    if (event.category !== "delivery" || event.kind !== "complete") {
      return session;
    }
  }

  if (event.category === "provision" && event.kind === "repo_created") {
    return {
      ...session,
      github_repo:
        typeof event.data.repo === "string" ? event.data.repo : session.github_repo,
      github_repo_id:
        typeof event.data.repoId === "number"
          ? event.data.repoId
          : session.github_repo_id,
      github_repo_url:
        typeof event.data.url === "string" ? event.data.url : session.github_repo_url,
    };
  }

  if (event.category === "provision" && event.kind === "app_install_required") {
    return {
      ...session,
      status: "awaiting_install",
    };
  }

  if (
    event.category === "provision" &&
    (event.kind === "app_installed" || event.kind === "bootstrap_started")
  ) {
    return {
      ...session,
      status: "bootstrapping",
      app_installation_id:
        typeof event.data.installationId === "number"
          ? event.data.installationId
          : session.app_installation_id,
    };
  }

  if (event.category === "provision" && event.kind === "bootstrap_complete") {
    return {
      ...session,
      status: "ready_to_launch",
      deploy_url:
        typeof event.data.deploy_url === "string"
          ? event.data.deploy_url
          : session.deploy_url,
    };
  }

  if (event.category === "build" && event.kind === "capacity_waitlisted") {
    return {
      ...session,
      status: "awaiting_capacity",
    };
  }

  if (
    event.category === "build" &&
    (event.kind === "pipeline_started" || event.kind === "agent_started")
  ) {
    return {
      ...session,
      status: "building",
    };
  }

  if (
    event.category === "delivery" &&
    (event.kind === "handoff_ready" || event.kind === "complete")
  ) {
    return {
      ...session,
      status: event.kind === "complete" ? "complete" : "handoff_ready",
      deploy_url:
        typeof event.data.deploy_url === "string"
          ? event.data.deploy_url
          : session.deploy_url,
    };
  }

  if (
    (event.category === "build" ||
      event.category === "delivery" ||
      event.category === "provision") &&
    (event.kind === "agent_error" ||
      event.kind === "pipeline_stalled" ||
      event.kind === "provider_retry_exhausted")
  ) {
    return {
      ...session,
      status: "stalled",
    };
  }

  return session;
}

export function parseBuildStatus(value: string): BuildSessionStatus {
  if (
    value === "refining" ||
    value === "ready" ||
    value === "awaiting_install" ||
    value === "bootstrapping" ||
    value === "ready_to_launch" ||
    value === "awaiting_capacity" ||
    value === "building" ||
    value === "handoff_ready" ||
    value === "complete" ||
    value === "stalled" ||
    value === "failed"
  ) {
    return value;
  }

  return "failed";
}

export function readPrdTitle(prdFinal: string | null): string | null {
  if (!prdFinal) {
    return null;
  }

  const firstLine = prdFinal.split("\n")[0]?.trim();
  if (!firstLine?.startsWith("# PRD: ")) {
    return null;
  }

  return firstLine.slice("# PRD: ".length).trim();
}
