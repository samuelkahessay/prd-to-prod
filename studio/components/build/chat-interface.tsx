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
      ? "Describe what you want to build, or paste a PRD..."
      : "Answer the question above...";

  return (
    <div className={styles.chat}>
      <div className={styles.messages} ref={messagesRef}>
        {messages.length === 0 && !streamingContent && (
          <div className={styles.empty}>
            Start by describing your idea. It can be a rough sketch or a
            detailed spec.
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
              {streamingContent}
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
                Sign in with GitHub to continue{" "}
              </span>
            )}
            <button className={styles.buildButton} onClick={onFinalize}>
              {user ? "Build it" : "Sign in & build"}
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
            Send
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
