const crypto = require("crypto");

/**
 * Mock LLM client that returns canned responses.
 * First call asks a follow-up question, second call returns a ready PRD.
 */
function createMockLLMClient() {
  const callCounts = new Map();

  async function streamChat(messages, onChunk) {
    // Determine which response to give based on message count
    const userMessages = messages.filter((m) => m.role === "user");
    const count = userMessages.length;

    let response;
    if (count <= 1) {
      response = MOCK_RESPONSES.first;
    } else {
      response = MOCK_RESPONSES.ready();
    }

    const content = JSON.stringify(response);

    // Simulate streaming with small delays
    const words = content.split(/(?<=[ ,{"])/);
    for (const word of words) {
      await sleep(15 + Math.random() * 25);
      onChunk(word);
    }

    return content;
  }

  async function chat(messages) {
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length <= 1) {
      return JSON.stringify(MOCK_RESPONSES.first);
    }
    return JSON.stringify(MOCK_RESPONSES.ready());
  }

  function parseResponse(content) {
    const parsed = JSON.parse(content);
    return {
      status: parsed.status || "needs_input",
      message: parsed.message || "",
      question: parsed.question || null,
      prd: parsed.prd || null,
    };
  }

  return { streamChat, chat, parseResponse };
}

const MOCK_RESPONSES = {
  first: {
    status: "needs_input",
    message:
      "That's a great starting point. Before I write the PRD — are you thinking of this as a tool for your own team, or something you'd ship to external users? That'll shape the auth model and how much polish the first version needs.",
    question:
      "Is this for internal team use or external users?",
    prd: null,
  },

  ready: () => ({
    status: "ready",
    message:
      "Great, I have enough to put together a solid PRD. Here's what I've synthesized from our conversation.",
    question: null,
    prd: {
      title: "Team Standup Dashboard",
      problem:
        "Engineering teams waste 15-30 minutes daily in synchronous standups. Remote and distributed teams suffer most — timezone gaps mean someone is always presenting to a screen. There's no lightweight async alternative that captures blockers, progress, and plans without requiring yet another Slack thread.",
      users:
        "Engineering teams of 5–20 people, especially distributed teams spanning 2+ timezones. Team leads who need visibility into blockers without scheduling calls.",
      features: [
        "Async daily status updates with structured fields (yesterday, today, blockers)",
        "Blockers board with @-mention escalation and auto-nudge after 24h",
        "Weekly digest email summarizing team velocity and recurring blockers",
        "Slack integration for reminders and blocker notifications",
        "Dashboard view showing team status at a glance with presence indicators",
      ],
      criteria: [
        "Team member can submit a status update in under 60 seconds",
        "Blockers surface to team lead within 5 minutes of submission",
        "Weekly digest accurately reflects the past 7 days of activity",
        "Works on mobile viewports (375px+) without horizontal scroll",
        "All interactive elements are keyboard-accessible",
      ],
    },
  }),
};

/**
 * Mock GitHub client that does nothing but return plausible data.
 */
function createMockGitHubClient() {
  return {
    async generateAppJwt() {
      return "mock-jwt-token";
    },
    async getInstallationToken() {
      return "mock-installation-token";
    },
    async checkAppInstallation() {
      return { installed: true, installationId: 12345 };
    },
    async createRepoFromTemplate(_token, { owner, name }) {
      return {
        id: Math.floor(Math.random() * 900000000) + 100000000,
        name,
        full_name: `${owner}/${name}`,
        html_url: `https://github.com/${owner}/${name}`,
        owner: { login: owner },
      };
    },
    async waitForRepo(_token, owner, name) {
      await sleep(500);
      return { id: 123456789, name, full_name: `${owner}/${name}` };
    },
    async createLabel() {},
    async configureActionsPermissions() {},
    async enableAutoMerge() {},
    async createIssue(_token, owner, repo, { title }) {
      return {
        number: 1,
        html_url: `https://github.com/${owner}/${repo}/issues/1`,
        title,
      };
    },
    async createIssueComment() {},
    async dispatchWorkflow() {},
  };
}

/**
 * Mock provisioner that emits events on a timer.
 * Uses the real provisioner logic but with mock GitHub client.
 */
function createMockProvisioner({ db, buildSessionStore, githubClient }) {
  // Reuse the real provisioner but with the mock GitHub client
  const { createProvisioner } = require("./provisioner");
  return createProvisioner({ db, buildSessionStore, githubClient });
}

/**
 * Mock build runner that simulates a build with timed events.
 */
function createMockBuildRunner({ buildSessionStore }) {
  async function dispatchBuild(sessionId) {
    const session = buildSessionStore.getSession(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "provisioning") {
      throw new Error(`Cannot build from status ${session.status}`);
    }

    buildSessionStore.updateSession(sessionId, { status: "building" });

    // Simulate a build timeline
    const events = [
      {
        delay: 500,
        category: "build",
        kind: "agent_started",
        data: {
          agent: "build-for-user",
          detail: `Builder agent started for ${session.github_repo}`,
        },
      },
      {
        delay: 2000,
        category: "build",
        kind: "agent_progress",
        data: {
          agent: "build-for-user",
          detail: "Analyzing PRD and planning implementation...",
        },
      },
      {
        delay: 3000,
        category: "build",
        kind: "agent_progress",
        data: {
          agent: "build-for-user",
          detail: "Decomposing PRD into 3 implementation tasks",
        },
      },
      {
        delay: 4500,
        category: "build",
        kind: "agent_progress",
        data: {
          agent: "repo-assist",
          detail: "Implementing core data model and API endpoints",
        },
      },
      {
        delay: 7000,
        category: "build",
        kind: "agent_progress",
        data: {
          agent: "frontend-agent",
          detail: "Building dashboard UI components",
        },
      },
      {
        delay: 9000,
        category: "build",
        kind: "pr_opened",
        data: {
          agent: "repo-assist",
          pr_url: `https://github.com/${session.github_repo}/pull/2`,
          pr_title: "[Pipeline] Implement core API and data model",
          pr_count: 1,
        },
      },
      {
        delay: 11000,
        category: "build",
        kind: "agent_progress",
        data: {
          agent: "pr-review-agent",
          detail: "Reviewing pull request #2",
        },
      },
      {
        delay: 13000,
        category: "build",
        kind: "pr_reviewed",
        data: {
          agent: "pr-review-agent",
          detail: "PR #2 approved — all acceptance criteria met",
        },
      },
      {
        delay: 14000,
        category: "build",
        kind: "pr_merged",
        data: {
          agent: "pr-review-agent",
          detail: "PR #2 merged to main",
          pr_count: 1,
        },
      },
      {
        delay: 15500,
        category: "build",
        kind: "ci_passed",
        data: {
          agent: "build-for-user",
          detail: "CI passed on main — all tests green",
        },
      },
      {
        delay: 17000,
        category: "delivery",
        kind: "deploying",
        data: { detail: "Deploying to Vercel preview..." },
      },
      {
        delay: 20000,
        category: "delivery",
        kind: "deployed",
        data: {
          deploy_url: `https://${(session.github_repo || "demo").split("/").pop()}.prd-to-prod.vercel.app`,
          detail: "Preview deployment live",
        },
      },
      {
        delay: 21000,
        category: "delivery",
        kind: "complete",
        data: {
          deploy_url: `https://${(session.github_repo || "demo").split("/").pop()}.prd-to-prod.vercel.app`,
          repo_url: `https://github.com/${session.github_repo}`,
          detail: "Build complete — your project is live!",
        },
      },
    ];

    // Fire events on schedule
    for (const event of events) {
      setTimeout(() => {
        try {
          buildSessionStore.appendEvent(sessionId, {
            category: event.category,
            kind: event.kind,
            data: event.data,
          });

          if (event.kind === "complete") {
            buildSessionStore.updateSession(sessionId, {
              status: "complete",
              deploy_url: event.data.deploy_url,
            });
          }
        } catch {
          // Session may have been cleaned up
        }
      }, event.delay);
    }
  }

  return { dispatchBuild };
}

/**
 * Mock OAuth — creates a demo user and session without GitHub.
 */
function createMockUser(db) {
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();

  const existing = db
    .prepare("SELECT id FROM users WHERE github_id = ?")
    .get(0);

  if (existing) return existing.id;

  db.prepare(
    `INSERT INTO users (id, github_id, github_login, github_avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, 0, "demo-user", "", now, now);

  return userId;
}

function createMockSession(db, userId) {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO user_sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(sessionId, userId, now, expiresAt);

  return sessionId;
}

function registerMockAuthRoutes(app, { db }) {
  const { encrypt } = require("./crypto");
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";

  // Skip real OAuth — create a demo user and session directly
  app.get("/pub/auth/github", (req, res) => {
    const userId = createMockUser(db);
    const sessionId = createMockSession(db, userId);

    // Also create a mock OAuth grant so provisioner can consume it
    const now = new Date().toISOString();
    const grantExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete existing grants for this user first
    db.prepare("DELETE FROM oauth_grants WHERE user_id = ?").run(userId);

    // Set ENCRYPTION_KEY if not already set (demo mode)
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    }

    db.prepare(
      `INSERT INTO oauth_grants (id, user_id, github_access_token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), userId, encrypt("mock-token"), now, grantExpires);

    res.cookie("build_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    const returnTo = req.query.return_to || "/build";
    res.redirect(`${frontendUrl}${returnTo}`);
  });

  // Auth check — look up session from cookie
  app.get("/pub/auth/me", (req, res) => {
    const sessionId = req.cookies?.build_session;
    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = db
      .prepare(
        `SELECT us.user_id, us.expires_at, u.github_id, u.github_login, u.github_avatar_url
         FROM user_sessions us
         JOIN users u ON u.id = us.user_id
         WHERE us.id = ? AND us.expires_at > ?`
      )
      .get(sessionId, new Date().toISOString());

    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }

    res.json({
      id: session.user_id,
      githubId: session.github_id,
      githubLogin: session.github_login,
      githubAvatarUrl: session.github_avatar_url,
    });
  });

  // Logout
  app.post("/pub/auth/logout", (req, res) => {
    const sessionId = req.cookies?.build_session;
    if (sessionId) {
      db.prepare("DELETE FROM user_sessions WHERE id = ?").run(sessionId);
    }
    res.clearCookie("build_session");
    res.json({ ok: true });
  });

  // OAuth callback — not used in demo mode but needs to exist
  app.get("/pub/auth/github/callback", (req, res) => {
    res.redirect(`${frontendUrl}/build`);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  createMockLLMClient,
  createMockGitHubClient,
  createMockProvisioner,
  createMockBuildRunner,
  registerMockAuthRoutes,
  createMockUser,
  createMockSession,
};
