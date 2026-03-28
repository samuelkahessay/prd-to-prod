export interface BuildQueueItem {
  issueNumber: number;
  lane: number;
  buildStartMs: number;
  prSpawnMs: number;
  prType: string;
  prLabel: string;
}

export interface ReviewQueueItem {
  prType: string;
  reviewDelayMs: number;
  deployDelayMs: number;
  killDelayMs: number;
  policySendDelayMs?: number;
  policyReturnDelayMs?: number;
}

export const BUILD_QUEUE: BuildQueueItem[] = [
  {
    issueNumber: 1,
    lane: 0,
    buildStartMs: 50,
    prSpawnMs: 600,
    prType: "pr-1",
    prLabel: "PR",
  },
  {
    issueNumber: 2,
    lane: 1,
    buildStartMs: 1100,
    prSpawnMs: 1700,
    prType: "pr-2",
    prLabel: "",
  },
  {
    issueNumber: 3,
    lane: 2,
    buildStartMs: 1600,
    prSpawnMs: 2050,
    prType: "pr-3",
    prLabel: "",
  },
];

export const REVIEW_QUEUE: ReviewQueueItem[] = [
  {
    prType: "pr-1",
    reviewDelayMs: 0,
    deployDelayMs: 350,
    killDelayMs: 800,
  },
  {
    prType: "pr-2",
    reviewDelayMs: 350,
    deployDelayMs: 1100,
    killDelayMs: 1500,
    policySendDelayMs: 600,
    policyReturnDelayMs: 850,
  },
  {
    prType: "pr-3",
    reviewDelayMs: 650,
    deployDelayMs: 1000,
    killDelayMs: 1400,
  },
];
