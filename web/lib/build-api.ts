import type {
  BuildSession,
  BuildEvent,
  BuildUser,
  LLMParsedResponse,
} from "./types";

const BASE =
  typeof window === "undefined"
    ? process.env.API_URL || "http://127.0.0.1:3000"
    : "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

interface ApiError extends Error {
  status?: number;
  action?: string;
  returnTo?: string;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    let parsed: Record<string, unknown> = {};
    try { parsed = await res.json(); } catch {}
    const err: ApiError = new Error(
      typeof parsed.message === "string" ? parsed.message : `API error: ${res.status} ${res.statusText}`
    );
    err.status = res.status;
    err.action = typeof parsed.action === "string" ? parsed.action : undefined;
    err.returnTo = typeof parsed.returnTo === "string" ? parsed.returnTo : undefined;
    throw err;
  }
  return res.json();
}

export interface StreamChunk {
  type: "chunk" | "done" | "error";
  content?: string;
  parsed?: LLMParsedResponse;
  error?: string;
}

export const buildApi = {
  getMe: (options?: { validateProvision?: boolean }) =>
    get<BuildUser>(
      options?.validateProvision ? "/pub/auth/me?validate=provision" : "/pub/auth/me"
    ),

  createSession: (demo = false) =>
    post<{ sessionId: string }>("/pub/build-session", demo ? { demo: true } : undefined),

  getSession: (id: string) =>
    get<{
      session: BuildSession;
      messages: BuildEvent[];
      gates?: {
        codeRedeemed: boolean;
        credentialsSubmitted: boolean;
        deployConfigured: boolean;
      };
    }>(
      `/pub/build-session/${id}`
    ),

  sendMessage: async function* (
    sessionId: string,
    content: string
  ): AsyncGenerator<StreamChunk> {
    const res = await fetch(`${BASE}/pub/build-session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          yield JSON.parse(trimmed.slice(6)) as StreamChunk;
        } catch {
          // skip malformed
        }
      }
    }
  },

  finalizeSession: (sessionId: string) =>
    post<{ sessionId: string; status: string; prd: unknown }>(
      `/pub/build-session/${sessionId}/finalize`
    ),

  redeemCode: (sessionId: string, code: string) =>
    post<{ redeemed: boolean }>(`/pub/build-session/${sessionId}/redeem`, { code }),

  submitCredentials: (sessionId: string, credentials: Record<string, string>) =>
    post<{ stored: boolean }>(`/pub/build-session/${sessionId}/credentials`, credentials),

  provisionRepo: (sessionId: string, options?: { repoName?: string }) =>
    post<{
      sessionId: string;
      status: string;
      installRequired: boolean;
      installUrl?: string;
    }>(`/pub/build-session/${sessionId}/provision`, options),

  startBuild: (sessionId: string) =>
    post<{ sessionId: string; status: string }>(
      `/pub/build-session/${sessionId}/start-build`
    ),

  streamBuildEvents: (
    sessionId: string,
    onEvent: (event: BuildEvent) => void
  ) => {
    const source = new EventSource(`/pub/build-session/${sessionId}/stream`);
    source.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => source.close();
  },

  logout: () => post<{ ok: boolean }>("/pub/auth/logout"),
};
