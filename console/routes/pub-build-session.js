const crypto = require("crypto");
const { getActiveUserSession } = require("../lib/auth-store");
const { enforceSessionBoundary } = require("./pub-provision");

function resolveUserId(db, req) {
  const sessionId = req.cookies?.build_session;
  if (!sessionId) return null;
  const session = getActiveUserSession(db, sessionId);
  return session ? session.user_id : null;
}

function registerBuildSessionRoutes(app, { db, buildSessionStore, serviceResolver }) {
  // Create a new build session
  app.post("/pub/build-session", (req, res) => {
    const isDemo = req.body?.demo === true;

    if (isDemo) {
      const { createMockUser, createMockSession } = require("../lib/mock-services");
      const { encrypt } = require("../lib/crypto");

      const userId = createMockUser(db);
      const authSessionId = createMockSession(db, userId);

      // Create a mock OAuth grant so provisioner can consume it
      const DEMO_MODE = process.env.DEMO_MODE === "true";
      if (!process.env.ENCRYPTION_KEY && DEMO_MODE) {
        process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
      }

      const now = new Date().toISOString();
      const grantExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.prepare("DELETE FROM oauth_grants WHERE user_id = ?").run(userId);
      db.prepare(
        `INSERT INTO oauth_grants (id, user_id, github_access_token, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), userId, encrypt("mock-token"), now, grantExpires);

      res.cookie("build_session", authSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      const session = buildSessionStore.createSession(userId, { isDemo: true });
      return res.status(201).json({ sessionId: session.id });
    }

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

    // Resolve LLM client based on session type
    const { llmClient } = serviceResolver.forSession(session.id);

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

    if (!enforceSessionBoundary(db, userId, session, res)) {
      return;
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
