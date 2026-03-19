"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInterface } from "@/components/build/chat-interface";
import { buildApi } from "@/lib/build-api";
import { navigateTo, replaceCurrentUrl } from "@/lib/browser-navigation";
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

const RESUME_ACTION_FINALIZE = "finalize";

export default function BuildPage() {
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
  const autoResumeHandledRef = useRef(false);

  // Check auth status on mount
  useEffect(() => {
    buildApi.getMe().then(setUser).catch(() => setUser(null));
  }, []);

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
    if (url.searchParams.get("demo") !== "true") return;

    // Remove demo param from URL immediately
    url.searchParams.delete("demo");
    replaceCurrentUrl(toRelativeUrl(url));

    // Create demo session (startSession isn't available yet, so call API directly)
    buildApi.createSession(true).then(({ sessionId: id }) => {
      setSessionId(id);
      setDemo(true);
      // Re-fetch auth since demo session sets a cookie
      buildApi.getMe().then(setUser).catch(() => setUser(null));
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("session", id);
      replaceCurrentUrl(toRelativeUrl(nextUrl));
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to start demo session");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const startSession = useCallback(async (demo = false) => {
    const { sessionId: id } = await buildApi.createSession(demo);
    setSessionId(id);
    persistSessionInUrl(id);
    return id;
  }, [persistSessionInUrl]);

  const finalizeAndRedirect = useCallback(
    async (id: string) => {
      setResumeAction(null);
      persistSessionInUrl(id, null);
      const result = await buildApi.finalizeSession(id);
      navigateTo(`/build/${result.sessionId}`);
    },
    [persistSessionInUrl]
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
      setResumeAction(RESUME_ACTION_FINALIZE);
      persistSessionInUrl(sessionId, RESUME_ACTION_FINALIZE);
      navigateTo(
        `/pub/auth/github?return_to=${encodeURIComponent(
          buildPagePath(sessionId, RESUME_ACTION_FINALIZE)
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
  }, [finalizeAndRedirect, persistSessionInUrl, sessionId, user]);

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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Build something</h1>
        <p className={styles.subtitle}>
          Describe what you want to build. We&apos;ll refine it together, then
          our agents will build it for you.
        </p>
        {demo && <span className={styles.demoPill}>Demo</span>}
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
      />
    </div>
  );
}

function buildPagePath(sessionId: string, resumeAction?: string | null): string {
  const params = new URLSearchParams({ session: sessionId });
  if (resumeAction) {
    params.set("resume", resumeAction);
  }
  return `/build?${params.toString()}`;
}

function toRelativeUrl(url: URL): string {
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
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
