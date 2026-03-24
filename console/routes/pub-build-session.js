const crypto = require("crypto");
const { getActiveUserSession } = require("../lib/auth-store");
const { enforceSessionBoundary } = require("./pub-provision");

function resolveUserId(db, req) {
  const sessionId = req.cookies?.build_session;
  if (!sessionId) return null;
  const session = getActiveUserSession(db, sessionId);
  return session ? session.user_id : null;
}

function resolveSessionAccess(db, buildSessionStore, req) {
  const session = buildSessionStore.getSession(req.params.id);
  if (!session) return { status: 404, error: "Session not found" };

  if (session.is_demo) return { session, allowed: true };

  const userId = resolveUserId(db, req);
  if (!userId) return { status: 404, error: "Session not found" };
  if (session.user_id !== userId) return { status: 404, error: "Session not found" };

  return { session, allowed: true, userId };
}

function resolveGitHubUserId(db, req) {
  const userId = resolveUserId(db, req);
  if (!userId) return null;
  const user = db.prepare("SELECT github_id FROM users WHERE id = ?").get(userId);
  if (!user || user.github_id === 0) return null;
  return userId;
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
      if (!process.env.ENCRYPTION_KEY) {
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

    const userId = resolveGitHubUserId(db, req);
    if (!userId) {
      return res.status(401).json({ error: "GitHub authentication required" });
    }
    const session = buildSessionStore.createSession(userId);
    res.status(201).json({ sessionId: session.id });
  });

  // Get a build session with its persisted events
  // Session ID (UUID) serves as the access token for reads — required for
  // server-rendered status page which cannot forward browser cookies.
  // Chat events are excluded for non-owner requests to protect PRD content.
  app.get("/pub/build-session/:id", (req, res) => {
    const session = buildSessionStore.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const userId = resolveUserId(db, req);
    const isOwner = session.is_demo || (userId && session.user_id === userId);
    const messages = isOwner
      ? buildSessionStore.getEvents(session.id)
      : buildSessionStore.getEvents(session.id).filter((e) => e.category !== "chat");

    const response = { session, messages };

    if (isOwner && !session.is_demo && userId) {
      const codeRow = db.prepare(
        "SELECT 1 FROM access_codes WHERE redeemed_by = ? AND (build_session_id IS NULL OR build_session_id = ?) LIMIT 1"
      ).get(userId, session.id);
      const credRow = db.prepare(
        "SELECT 1 FROM build_session_refs WHERE build_session_id = ? AND ref_type = 'credential' AND ref_key = 'OPENAI_API_KEY' LIMIT 1"
      ).get(session.id);
      const deployConfigured = [
        "VERCEL_TOKEN",
        "VERCEL_ORG_ID",
        "VERCEL_PROJECT_ID",
      ].every((key) =>
        db.prepare(
          "SELECT 1 FROM build_session_refs WHERE build_session_id = ? AND ref_type = 'credential' AND ref_key = ? LIMIT 1"
        ).get(session.id, key)
      );
      response.gates = {
        codeRedeemed: !!codeRow,
        credentialsSubmitted: !!credRow,
        deployConfigured,
      };
    }

    res.json(response);
  });

  // Send a message and get LLM response (streaming SSE)
  app.post("/pub/build-session/:id/message", async (req, res) => {
    const access = resolveSessionAccess(db, buildSessionStore, req);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.error });
    }
    const session = access.session;
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

      // Parse structured response — fall back gracefully if model returns prose
      let parsed;
      try {
        parsed = llmClient.parseResponse(fullContent);
      } catch (parseErr) {
        console.warn("LLM response parse fallback:", parseErr.message);
        parsed = {
          status: "needs_input",
          message: fullContent.trim(),
          question: fullContent.trim().split("\n").pop() || "Could you tell me more?",
          prd: null,
        };
      }

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

  // Finalize a build session (requires auth + ownership)
  app.post("/pub/build-session/:id/finalize", (req, res) => {
    const access = resolveSessionAccess(db, buildSessionStore, req);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.error });
    }
    const session = access.session;

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

    // Lock PRD and transition status (session already owned from creation)
    buildSessionStore.updateSession(session.id, {
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
