"use client";

import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import type { BuildUser, LLMParsedResponse } from "@/lib/types";
import styles from "./chat-interface.module.css";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  parsed?: LLMParsedResponse;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  streamingContent: string | null;
  onSend: (content: string) => void;
  disabled: boolean;
  prdReady: boolean;
  onFinalize: () => void;
  user: BuildUser | null;
  error: string | null;
  mode?: "build" | "demo";
}

export function ChatInterface({
  messages,
  streamingContent,
  onSend,
  disabled,
  prdReady,
  onFinalize,
  user,
  error,
  mode = "build",
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    setInput("");
    onSend(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const placeholder =
    messages.length === 0
      ? mode === "demo"
        ? "Paste a PRD or describe the app you want the floor to build..."
        : "Describe what you want to build, or paste a PRD..."
      : mode === "demo"
        ? "Answer the question so the demo can keep moving..."
        : "Answer the question above...";

  return (
    <div className={styles.chat}>
      <div className={styles.messages} ref={messagesRef}>
        {messages.length === 0 && !streamingContent && (
          <div className={styles.empty}>
            {mode === "demo"
              ? "Start with a rough brief or a full PRD. We&apos;ll tighten it, then hand it to the floor."
              : "Start by describing your idea. It can be a rough sketch or a detailed spec."}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${
              msg.role === "user"
                ? styles.userMessage
                : msg.role === "system"
                  ? styles.systemMessage
                  : styles.assistantMessage
            }`}
          >
            <div className={styles.roleLabel}>
              {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "prd-to-prod"}
            </div>
            <div>{formatMessageContent(msg)}</div>
          </div>
        ))}

        {streamingContent && (
          <div className={styles.streaming}>
            <div className={styles.roleLabel}>prd-to-prod</div>
            <div>
              {formatStreamingContent(streamingContent)}
              <span className={styles.cursor} />
            </div>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {prdReady && (
        <div className={styles.actions}>
          <span className={styles.readyBadge}>PRD ready</span>
          <div>
            {!user && (
              <span className={styles.authHint}>
                {mode === "demo"
                  ? "Demo runs can continue without GitHub sign-in "
                  : "Sign in with GitHub to continue "}
              </span>
            )}
            <button className={styles.buildButton} onClick={onFinalize}>
              {mode === "demo"
                ? "Launch factory floor"
                : user
                  ? "Launch pipeline"
                  : "Sign in with GitHub to launch"}
            </button>
          </div>
        </div>
      )}

      {!prdReady && (
        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
          />
          <button
            className={styles.sendButton}
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
          >
            {mode === "demo" ? "Shape PRD" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatMessageContent(msg: ChatMessage): string {
  const parsed = msg.parsed ?? tryParseJson(msg.content);
  if (!parsed) return msg.content;

  const parts: string[] = [];
  if (parsed.message) parts.push(parsed.message);
  if (parsed.question) parts.push(parsed.question);
  return parts.join("\n\n") || msg.content;
}

function tryParseJson(content: string): { message?: string; question?: string } | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function formatStreamingContent(content: string): string {
  const parsed = tryParseJson(content);
  if (parsed) {
    return formatParsedContent(parsed) || content;
  }

  const preview = formatParsedContent({
    message: extractJsonStringValue(content, "message") ?? undefined,
    question: extractJsonStringValue(content, "question") ?? undefined,
  });

  if (preview) {
    return preview;
  }

  return content.trimStart().startsWith("{") ? "" : content;
}

function formatParsedContent(parsed: {
  message?: string | null;
  question?: string | null;
}): string {
  return [parsed.message, parsed.question]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n\n");
}

function extractJsonStringValue(content: string, key: string): string | null {
  const marker = findJsonStringMarker(content, key);
  if (marker === -1) {
    return null;
  }

  return readJsonStringValue(content, marker);
}

function findJsonStringMarker(content: string, key: string): number {
  const propertyPattern = new RegExp(`"${escapeForRegExp(key)}"\\s*:\\s*"`);
  const match = propertyPattern.exec(content);
  return match ? match.index + match[0].length : -1;
}

function readJsonStringValue(content: string, startIndex: number): string {
  let value = "";
  let index = startIndex;

  while (index < content.length) {
    const char = content[index];

    if (char === '"') {
      return value;
    }

    if (char === "\\") {
      index++;
      if (index < content.length) {
        const escaped = content[index];
        if (escaped === "n") value += "\n";
        else if (escaped === "t") value += "\t";
        else value += escaped;
      }
    } else {
      value += char;
    }

    index++;
  }

  return value;
}

function escapeForRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
