import type { BuildEvent } from "@/lib/types";

export type FactoryPlaybackMode = "instant" | "cinematic";
export type FactoryReplayProfile = "demo" | "recording";

const DEMO_LEAD_IN_MS = 900;
const RECORDING_LEAD_IN_MS = 1_100;
const RECORDING_SEED = 20260324;

const DEMO_DELAYS_MS: Record<string, number> = {
  repo_creating: 1800,
  repo_created: 1300,
  app_installed: 1200,
  bootstrap_started: 1300,
  bootstrap_complete: 1600,
  prd_issue_created: 1400,
  pipeline_started: 1800,
  agent_started: 1700,
  agent_progress: 1900,
  pr_opened: 2300,
  pr_reviewed: 1700,
  pr_merged: 1900,
  ci_passed: 1600,
  deploying: 1700,
  deploy_started: 1700,
  deployed: 1800,
  complete: 2500,
  handoff_ready: 2500,
  pipeline_stalled: 1700,
  provider_retry_exhausted: 1700,
};

const RECORDING_DELAYS_MS: Record<string, number> = {
  ...DEMO_DELAYS_MS,
  repo_creating: 1900,
  repo_created: 1400,
  pipeline_started: 1900,
  agent_started: 1800,
  agent_progress: 2000,
  pr_opened: 2600,
  pr_reviewed: 1900,
  pr_merged: 2100,
  deploying: 1900,
  deploy_started: 1900,
  deployed: 2100,
  complete: 3000,
  handoff_ready: 3000,
};

export function isFactoryPlaybackEvent(event: BuildEvent): boolean {
  return event.category !== "chat";
}

export function getFactoryReplayLeadIn(
  profile: FactoryReplayProfile = "demo"
): number {
  if (profile === "recording") {
    return RECORDING_LEAD_IN_MS;
  }

  return DEMO_LEAD_IN_MS;
}

export function getFactoryReplayDelay(
  event: BuildEvent,
  profile: FactoryReplayProfile = "demo"
): number {
  if (profile === "recording") {
    return RECORDING_DELAYS_MS[event.kind] ?? 1600;
  }

  return DEMO_DELAYS_MS[event.kind] ?? 1500;
}

export function getFactoryReplaySeed(
  profile: FactoryReplayProfile = "demo"
): number | null {
  if (profile === "recording") {
    return RECORDING_SEED;
  }

  return null;
}
