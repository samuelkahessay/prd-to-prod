// Run types
export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface Run {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: RunStatus;
  mode: "new" | "existing";
  inputSource: "workiq" | "notes";
  targetRepo: string;
  summary: string;
  events?: RunEvent[];
}

export type EventType = "system" | "auto" | "blocked" | "human";
export type EventKind =
  | "stage_start"
  | "stage_complete"
  | "stage_error"
  | "progress"
  | "log"
  | "artifact"
  | "run_complete"
  | "run_error";

export interface RunEvent {
  id: string;
  stage: string;
  type: EventType;
  kind: EventKind;
  data: Record<string, unknown>;
  timestamp: string;
}

// Stage types for the UI projection
export type StageName = "Extract" | "Build" | "Review" | "Policy" | "Deploy";
export type StageState = "done" | "active" | "blocked" | "pending";

export interface StageStatus {
  name: StageName;
  state: StageState;
  label: string;
}

// Queue types
export type Resolution = "approved" | "rejected";

export interface QueueItem {
  id: string;
  runId: string;
  event: string;
  ref: string;
  reason: string;
  policyRule: string;
  queuedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: Resolution;
}

// Decision types
export interface Decision {
  timestamp: string;
  type: EventType;
  event: string;
  detail: string;
  policyRef?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: Resolution;
}

// Audit types
export interface AuditEntry {
  timestamp: string;
  type: EventType;
  event: string;
  detail: string;
  ref: string | null;
}

// Preflight types
export interface PreflightCheck {
  id: string;
  name: string;
  required: boolean;
  present: boolean;
}

// Evidence types (for SSG landing page)
export type EvidenceOutcome =
  | "running"
  | "merged"
  | "healed"
  | "blocked"
  | "drill";

export interface EvidenceRow {
  time: string;
  event: string;
  refs: { label: string; url: string; type: "issue" | "pr" | "heal" | "policy" }[];
  duration: string | null;
  outcome: EvidenceOutcome;
}
