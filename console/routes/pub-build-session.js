const { getActiveUserSession } = require("../lib/auth-store");

function resolveUserId(db, req) {
  const sessionId = req.cookies?.build_session;
  if (!sessionId) return null;
  const session = getActiveUserSession(db, sessionId);
  return session ? session.user_id : null;
}

function registerBuildSessionRoutes(app, { db, buildSessionStore, llmClient }) {
  // Create a new build session
  app.post("/pub/build-session", (req, res) => {
    const userId = resolveUserId(db, req);
    const session = buildSessionStore.createSession(userId);
    res.status(201).json({ sessionId: session.id });
  });

  // Get a build session with its persisted events
  app.get("/pub/build-session/:id", (req, res) => {
    const session = buildSessionStore.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const messages = buildSessionStore.getEvents(session.id);
    res.json({ session, messages });
  });

  // Send a message and get LLM response (streaming SSE)
  app.post("/pub/build-session/:id/message", async (req, res) => {
    const session = buildSessionStore.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.status !== "refining") {
      return res.status(400).json({ error: "Session is not in refining state" });
    }

    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Persist user message
    buildSessionStore.appendEvent(session.id, {
      category: "chat",
      kind: "user_message",
      data: { content: content.trim(), role: "user" },
    });

    // Build conversation history for LLM
    const chatEvents = buildSessionStore.getChatMessages(session.id);
    const llmMessages = chatEvents
      .filter((e) => e.kind === "user_message" || e.kind === "assistant_message")
      .map((e) => ({
        role: e.data.role === "user" ? "user" : "assistant",
        content: e.data.content,
      }));

    // Stream response via SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let fullContent = "";
    try {
      fullContent = await llmClient.streamChat(llmMessages, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
      });

      // Parse structured response
      const parsed = llmClient.parseResponse(fullContent);

      // Persist complete assistant message
      buildSessionStore.appendEvent(session.id, {
        category: "chat",
        kind: "assistant_message",
        data: {
          content: fullContent,
          role: "assistant",
          parsed,
        },
      });

      // Send the parsed structure as the final event
      res.write(
        `data: ${JSON.stringify({ type: "done", parsed })}\n\n`
      );
    } catch (err) {
      console.error("LLM streaming error:", err);
      res.write(
        `data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`
      );
    }

    res.end();
  });

  // Finalize a build session (requires auth)
  app.post("/pub/build-session/:id/finalize", (req, res) => {
    const userId = resolveUserId(db, req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required to finalize" });
    }

    const session = buildSessionStore.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.status !== "refining") {
      return res.status(400).json({ error: "Session is not in refining state" });
    }

    // Find the last assistant message with a ready PRD
    const chatEvents = buildSessionStore.getChatMessages(session.id);
    const lastAssistant = [...chatEvents]
      .reverse()
      .find((e) => e.kind === "assistant_message" && e.data.parsed?.status === "ready");

    if (!lastAssistant?.data?.parsed?.prd) {
      return res.status(400).json({ error: "No finalized PRD found. Continue the conversation." });
    }

    const prd = lastAssistant.data.parsed.prd;
    const prdMarkdown = formatPrdMarkdown(prd);

    // Bind session to user and set final PRD
    buildSessionStore.updateSession(session.id, {
      user_id: userId,
      status: "ready",
      prd_final: prdMarkdown,
    });

    buildSessionStore.appendEvent(session.id, {
      category: "chat",
      kind: "system_message",
      data: { content: "PRD finalized. Ready to build.", role: "system" },
    });

    res.json({
      sessionId: session.id,
      status: "ready",
      prd: prd,
    });
  });
}

function formatPrdMarkdown(prd) {
  const lines = [`# PRD: ${prd.title}`, ""];
  if (prd.problem) {
    lines.push("## Problem", "", prd.problem, "");
  }
  if (prd.users) {
    lines.push("## Target Users", "", prd.users, "");
  }
  if (prd.features?.length) {
    lines.push("## Core Features", "");
    for (const f of prd.features) {
      lines.push(`- ${f}`);
    }
    lines.push("");
  }
  if (prd.criteria?.length) {
    lines.push("## Acceptance Criteria", "");
    for (const c of prd.criteria) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

module.exports = { registerBuildSessionRoutes };
