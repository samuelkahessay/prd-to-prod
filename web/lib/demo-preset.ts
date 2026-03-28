export type DemoReplayPreset = "demo" | "recording";

export const DEFAULT_DEMO_REPLAY_PRESET: DemoReplayPreset = "demo";

export function normalizeDemoReplayPreset(
  value: string | null | undefined
): DemoReplayPreset {
  return value === "recording" ? "recording" : DEFAULT_DEMO_REPLAY_PRESET;
}

export function appendDemoReplayPreset(
  params: URLSearchParams,
  preset: DemoReplayPreset
): URLSearchParams {
  if (preset === "recording") {
    params.set("preset", "recording");
  } else {
    params.delete("preset");
  }

  return params;
}

export function getDemoReplayPresetQuery(
  preset: DemoReplayPreset
): string {
  const params = new URLSearchParams();
  appendDemoReplayPreset(params, preset);
  return params.toString();
}
