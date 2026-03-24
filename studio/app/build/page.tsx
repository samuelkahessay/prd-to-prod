"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInterface } from "@/components/build/chat-interface";
import { buildApi } from "@/lib/build-api";
import { navigateTo, replaceCurrentUrl } from "@/lib/browser-navigation";
import {
  appendDemoReplayPreset,
  normalizeDemoReplayPreset,
  type DemoReplayPreset,
} from "@/lib/demo-preset";
import type {
  BuildEvent,
  BuildSession,
  BuildUser,
  LLMParsedResponse,
} from "@/lib/types";
import styles from "./page.module.css";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  parsed?: LLMParsedResponse;
}

interface BuildPageProps {
  initialMode?: "build" | "demo";
}

const RESUME_ACTION_FINALIZE = "finalize";

export default function BuildPage({
  initialMode = "build",
}: BuildPageProps) {
  const [user, setUser] = useState<BuildUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [prdReady, setPrdReady] = useState(false);
  const [hydratingSession, setHydratingSession] = useState(false);
  const [resumeAction, setResumeAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [entryMode, setEntryMode] = useState<"build" | "demo">(initialMode);
  const autoResumeHandledRef = useRef(false);

  const [authChecked, setAuthChecked] = useState(false);

  // Check auth status on mount — redirect to OAuth if not authenticated (unless demo)
  useEffect(() => {
    const url = new URL(window.location.href);
    const isDemo = entryMode === "demo" || url.searchParams.get("demo") === "true";
    const hasPersistedSession = url.searchParams.has("session");

    if (isDemo && entryMode !== "demo") {
      setEntryMode("demo");
    }

    buildApi
      .getMe()
      .then((u) => {
        setUser(u);
        setAuthChecked(true);
      })
      .catch(() => {
        setUser(null);
        setAuthChecked(true);
        if (!isDemo && !hasPersistedSession) {
          navigateTo(
            `/pub/auth/github?return_to=${encodeURIComponent(
              `${url.pathname}${url.search}`
            )}`
          );
        }
      });
  }, [entryMode]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthError = url.searchParams.get("error");
    const persistedSessionId = url.searchParams.get("session");
    const nextResumeAction = url.searchParams.get("resume");

    if (nextResumeAction) {
      autoResumeHandledRef.current = false;
      setResumeAction(nextResumeAction);
    }

    if (oauthError) {
      setError(`Authentication failed: ${oauthError}`);
      url.searchParams.delete("error");
      replaceCurrentUrl(toRelativeUrl(url));
    }

    if (!persistedSessionId) {
      return;
    }

    setHydratingSession(true);
    buildApi
      .getSession(persistedSessionId)
      .then(({ session, messages: storedMessages }) => {
        setSessionId(session.id);
        setDemo(!!session.is_demo);
        if (session.is_demo) {
          setEntryMode("demo");
        }
        setMessages(storedMessages.map(toChatMessage).filter(isChatMessage));
        setPrdReady(hasReadyPrd(session, storedMessages));
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to restore build session"
        );
      })
      .finally(() => {
        setHydratingSession(false);
      });
  }, []);

  // Auto-start demo session when ?demo=true is in the URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const isDemoEntry =
      entryMode === "demo" || url.searchParams.get("demo") === "true";
    const persistedSessionId = url.searchParams.get("session");

    if (!isDemoEntry || persistedSessionId) {
      return;
    }

    const replayPreset = normalizeDemoReplayPreset(url.searchParams.get("preset"));

    if (url.searchParams.get("demo") === "true") {
      url.searchParams.delete("demo");
      appendDemoReplayPreset(url.searchParams, replayPreset);
      replaceCurrentUrl(toRelativeUrl(url));
    }

    buildApi
      .createSession(true)
      .then(({ sessionId: id }) => {
        setSessionId(id);
        setDemo(true);
        setEntryMode("demo");
        buildApi.getMe().then(setUser).catch(() => setUser(null));
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("session", id);
        appendDemoReplayPreset(nextUrl.searchParams, replayPreset);
        replaceCurrentUrl(toRelativeUrl(nextUrl));
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to start demo session"
        );
      });
  }, [entryMode]);

  const persistSessionInUrl = useCallback(
    (nextSessionId: string, nextResumeAction?: string | null) => {
      const url = new URL(window.location.href);
      url.searchParams.set("session", nextSessionId);
      if (nextResumeAction) {
        url.searchParams.set("resume", nextResumeAction);
      } else {
        url.searchParams.delete("resume");
      }
      replaceCurrentUrl(toRelativeUrl(url));
    },
    []
  );

  const startSession = useCallback(
    async (demoMode = entryMode === "demo") => {
      const { sessionId: id } = await buildApi.createSession(demoMode);
      setSessionId(id);
      setDemo(demoMode);
      persistSessionInUrl(id);
      return id;
    },
    [entryMode, persistSessionInUrl]
  );

  const finalizeAndRedirect = useCallback(
    async (id: string) => {
      setResumeAction(null);
      persistSessionInUrl(id, null);
      const result = await buildApi.finalizeSession(id);
      navigateTo(
        buildStatusPath(
          result.sessionId,
          readRequestedRepoNameFromLocation(),
          demo,
          readReplayPresetFromLocation()
        )
      );
    },
    [demo, persistSessionInUrl]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);

      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await startSession();
      }

      setMessages((prev) => [...prev, { role: "user", content }]);
      setStreaming(true);
      setStreamingContent("");

      try {
        let fullContent = "";
        let parsed: LLMParsedResponse | undefined;
        let hadError = false;

        for await (const chunk of buildApi.sendMessage(
          currentSessionId,
          content
        )) {
          if (chunk.type === "chunk" && chunk.content) {
            fullContent += chunk.content;
            setStreamingContent(fullContent);
          } else if (chunk.type === "done" && chunk.parsed) {
            parsed = chunk.parsed;
            if (parsed.status === "ready") {
              setPrdReady(true);
            }
          } else if (chunk.type === "error") {
            hadError = true;
            setError(chunk.error || "LLM error");
          }
        }

        if (!hadError) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: fullContent,
              parsed,
            },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setStreaming(false);
        setStreamingContent("");
      }
    },
    [sessionId, startSession]
  );

  const handleFinalize = useCallback(async () => {
    if (!sessionId) return;

    if (!user) {
      const requestedRepoName = readRequestedRepoNameFromLocation();
      const replayPreset = readReplayPresetFromLocation();
      setResumeAction(RESUME_ACTION_FINALIZE);
      persistSessionInUrl(sessionId, RESUME_ACTION_FINALIZE);
      navigateTo(
        `/pub/auth/github?return_to=${encodeURIComponent(
          buildPagePath(
            sessionId,
            RESUME_ACTION_FINALIZE,
            requestedRepoName,
            entryMode,
            replayPreset
          )
        )}`
      );
      return;
    }

    try {
      await finalizeAndRedirect(sessionId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to finalize"
      );
    }
  }, [entryMode, finalizeAndRedirect, persistSessionInUrl, sessionId, user]);

  const isDemoExperience = demo || entryMode === "demo";
  const hasPendingSessionRestore =
    sessionId !== null ||
    hydratingSession ||
    (typeof window !== "undefined" &&
      new URL(window.location.href).searchParams.has("session"));

  useEffect(() => {
    if (
      resumeAction !== RESUME_ACTION_FINALIZE ||
      !user ||
      !sessionId ||
      !prdReady ||
      hydratingSession ||
      autoResumeHandledRef.current
    ) {
      return;
    }

    autoResumeHandledRef.current = true;
    finalizeAndRedirect(sessionId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to finalize");
    });
  }, [
    finalizeAndRedirect,
    hydratingSession,
    prdReady,
    resumeAction,
    sessionId,
    user,
  ]);

  if (!authChecked) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            {isDemoExperience ? "Watch the floor take over" : "Launch a governed build"}
          </h1>
          <p className={styles.subtitle}>Checking authentication&hellip;</p>
        </header>
      </div>
    );
  }

  if (!user && !isDemoExperience && !hasPendingSessionRestore) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Launch a governed build</h1>
          <p className={styles.subtitle}>Redirecting to GitHub for authentication&hellip;</p>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {isDemoExperience
            ? "Paste a PRD. Watch five agents build it."
            : "Refine the PRD, then launch the pipeline."}
        </h1>
        <p className={styles.subtitle}>
          {isDemoExperience
            ? "Shape the brief in a few turns, then cut to the factory floor for the cinematic replay."
            : "Describe what you want to build. We&apos;ll refine the scope together, then launch a governed pipeline run."}
        </p>
        {isDemoExperience && <span className={styles.demoPill}>Demo</span>}
      </header>

      <ChatInterface
        messages={messages}
        streamingContent={streaming ? streamingContent : null}
        onSend={sendMessage}
        disabled={streaming || hydratingSession}
        prdReady={prdReady}
        onFinalize={handleFinalize}
        user={user}
        error={error}
        mode={isDemoExperience ? "demo" : "build"}
      />
    </div>
  );
}

function buildPagePath(
  sessionId: string,
  resumeAction?: string | null,
  requestedRepoName?: string | null,
  entryMode: "build" | "demo" = "build",
  replayPreset: DemoReplayPreset = "demo"
): string {
  const params = new URLSearchParams({ session: sessionId });
  if (resumeAction) {
    params.set("resume", resumeAction);
  }
  if (requestedRepoName) {
    params.set("e2e_repo_name", requestedRepoName);
  }
  if (entryMode === "demo") {
    appendDemoReplayPreset(params, replayPreset);
  }
  const basePath = entryMode === "demo" ? "/demo" : "/build";
  return `${basePath}?${params.toString()}`;
}

function buildStatusPath(
  sessionId: string,
  requestedRepoName?: string | null,
  isDemo = false,
  replayPreset: DemoReplayPreset = "demo"
): string {
  const params = new URLSearchParams();
  if (requestedRepoName) {
    params.set("e2e_repo_name", requestedRepoName);
  }
  if (isDemo) {
    appendDemoReplayPreset(params, replayPreset);
  }
  const basePath = isDemo ? `/demo/${sessionId}` : `/build/${sessionId}`;
  return `${basePath}${params.size > 0 ? `?${params.toString()}` : ""}`;
}

function toRelativeUrl(url: URL): string {
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

function readRequestedRepoNameFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new URL(window.location.href).searchParams.get("e2e_repo_name");
}

function readReplayPresetFromLocation(): DemoReplayPreset {
  if (typeof window === "undefined") {
    return "demo";
  }

  return normalizeDemoReplayPreset(
    new URL(window.location.href).searchParams.get("preset")
  );
}

function hasReadyPrd(session: BuildSession, buildEvents: BuildEvent[]): boolean {
  if (session.status !== "refining") {
    return true;
  }

  return buildEvents.some((event) => {
    const parsed = event.data.parsed;
    return isParsedResponse(parsed) && parsed.status === "ready";
  });
}

function toChatMessage(event: BuildEvent): ChatMessage | null {
  const role = event.data.role;
  const content = event.data.content;
  if (!isChatRole(role) || typeof content !== "string") {
    return null;
  }

  const parsed = isParsedResponse(event.data.parsed)
    ? event.data.parsed
    : undefined;

  return {
    role,
    content,
    parsed,
  };
}

function isChatRole(value: unknown): value is ChatMessage["role"] {
  return value === "user" || value === "assistant" || value === "system";
}

function isParsedResponse(value: unknown): value is LLMParsedResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parsed = value as Partial<LLMParsedResponse>;
  const validStatus =
    parsed.status === "needs_input" || parsed.status === "ready";
  const validQuestion =
    parsed.question === null || typeof parsed.question === "string";

  return validStatus && typeof parsed.message === "string" && validQuestion;
}

function isChatMessage(value: ChatMessage | null): value is ChatMessage {
  return value !== null;
}
