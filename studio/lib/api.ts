import type {
  Run,
  QueueItem,
  Decision,
  AuditEntry,
  PreflightCheck,
  E2ERun,
} from "./types";

// Server-side (RSC) fetch has no browser context, so relative URLs fail.
// Use API_URL env var for server-side, empty string for client-side (proxied via Next.js rewrites).
const BASE =
  typeof window === "undefined"
    ? process.env.API_URL || "http://127.0.0.1:3000"
    : "";

interface ApiRequestOptions {
  cookieHeader?: string;
}

function buildHeaders(options?: ApiRequestOptions): HeadersInit | undefined {
  if (!options?.cookieHeader) {
    return undefined;
  }

  return {
    cookie: options.cookieHeader,
  };
}

async function get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: buildHeaders(options),
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(buildHeaders(options) || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  preflight: (options?: ApiRequestOptions) =>
    get<{ checks: PreflightCheck[] }>("/api/preflight", options).then((r) => r.checks),

  startRun: (payload: {
    inputSource: string;
    query?: string;
    notes?: string;
    mode: string;
    targetRepo?: string;
    mockMode?: boolean;
  }, options?: ApiRequestOptions) => post<{ runId: string }>("/api/run", payload, options),

  getRun: (id: string, options?: ApiRequestOptions) => get<Run>(`/api/run/${id}`, options),

  listRuns: (options?: ApiRequestOptions) =>
    get<{ runs: Run[] }>("/api/runs", options).then((r) => r.runs),

  streamRun: (id: string, onEvent: (event: unknown) => void) => {
    const source = new EventSource(`/api/run/${id}/stream`);
    source.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => source.close();
  },

  getQueue: (options?: ApiRequestOptions) => get<QueueItem[]>("/api/queue", options),

  resolveQueueItem: (id: string, resolution: "approved" | "rejected") =>
    post<QueueItem>(`/api/queue/${id}/resolve`, { resolution }),

  getDecisions: (runId: string, options?: ApiRequestOptions) =>
    get<Decision[]>(`/api/run/${runId}/decisions`, options),

  getAudit: (runId: string, options?: ApiRequestOptions) =>
    get<AuditEntry[]>(`/api/run/${runId}/audit`, options),

  listE2ERuns: (options?: ApiRequestOptions) =>
    get<{ runs: E2ERun[] }>("/api/e2e/runs", options).then((r) => r.runs),

  getE2ERun: (id: string, options?: ApiRequestOptions) =>
    get<E2ERun>(`/api/e2e/runs/${id}`, options),

  startE2ERun: (
    payload: {
      lane: string;
      keepRepo?: boolean;
      cookieJarPath?: string;
    },
    options?: ApiRequestOptions
  ) => post<{ runId: string; run: E2ERun }>("/api/e2e/runs", payload, options),

  cleanupE2ERun: (id: string, force = false, options?: ApiRequestOptions) =>
    post<{ run: E2ERun }>(`/api/e2e/runs/${id}/cleanup`, { force }, options),

  getE2EReport: (
    id: string,
    options?: ApiRequestOptions
  ) =>
    get<{
      reportJsonPath: string;
      reportMarkdownPath: string;
      reportJson: Record<string, unknown> | null;
      reportMarkdown: string | null;
    }>(`/api/e2e/runs/${id}/report`, options),

  streamE2ERun: (id: string, onEvent: (event: unknown) => void) => {
    const source = new EventSource(`/api/e2e/runs/${id}/stream`);
    source.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => source.close();
  },

  exportE2EAuthCookie: (cookieJarPath: string) =>
    post<{ ok: boolean; cookieJarPath: string; authBootstrapUrl: string }>(
      "/pub/e2e/auth-cookie",
      { path: cookieJarPath }
    ),

  getE2EAuthCookie: (cookieJarPath: string, options?: ApiRequestOptions) =>
    get<{ ok: boolean; cookieJarPath: string; user: Record<string, unknown> }>(
      `/pub/e2e/auth-cookie?path=${encodeURIComponent(cookieJarPath)}`,
      options
    ),
};
