import { classifyTicket, matchKnowledgeBase, processTicket } from "@/components/showcase/ticket-deflection/classifier";
import type { Ticket, KnowledgeArticle } from "@/components/showcase/ticket-deflection/store";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t-test",
    title: "Test ticket",
    description: "Test description",
    category: null,
    severity: null,
    status: "New",
    resolution: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeArticle(overrides: Partial<KnowledgeArticle> = {}): KnowledgeArticle {
  return {
    id: "kb-test",
    title: "How to reset your password",
    content: "Go to the login page and click Forgot Password to reset your account credentials.",
    tags: ["password", "reset", "login", "account"],
    category: "AccountIssue",
    ...overrides,
  };
}

// ── classifyTicket ────────────────────────────────────────────────────────────

describe("classifyTicket — category", () => {
  it("returns Bug for input containing 'error'", () => {
    const { category } = classifyTicket("Something went wrong", "There is an error in the response");
    expect(category).toBe("Bug");
  });

  it("returns Bug for input containing 'crash'", () => {
    const { category } = classifyTicket("App crash on startup", "The application crashes immediately");
    expect(category).toBe("Bug");
  });

  it("returns Bug for input containing 'broken'", () => {
    const { category } = classifyTicket("Button is broken", "The submit button is broken and does nothing");
    expect(category).toBe("Bug");
  });

  it("returns HowTo for input containing 'how to'", () => {
    const { category } = classifyTicket("How to connect Slack", "I want to know how to set up the Slack integration");
    expect(category).toBe("HowTo");
  });

  it("returns HowTo for input containing 'tutorial'", () => {
    const { category } = classifyTicket("Getting started tutorial", "Is there a tutorial for new users?");
    expect(category).toBe("HowTo");
  });

  it("returns AccountIssue for login/password keywords", () => {
    const { category } = classifyTicket("Cannot login", "I forgot my password and cannot access my account");
    expect(category).toBe("AccountIssue");
  });

  it("returns FeatureRequest for feature/enhancement keywords", () => {
    const { category } = classifyTicket("Feature request", "It would be an enhancement to add dark mode");
    expect(category).toBe("FeatureRequest");
  });

  it("returns Other when no category keywords match", () => {
    const { category } = classifyTicket("Xyz", "Abc def");
    expect(category).toBe("Other");
  });
});

describe("classifyTicket — severity", () => {
  it("returns Critical for 'outage' keyword", () => {
    const { severity } = classifyTicket("Production outage", "The entire system is down for all users");
    expect(severity).toBe("Critical");
  });

  it("returns High for 'error' keyword when no higher-severity keyword is present", () => {
    const { severity } = classifyTicket("API returns error", "The endpoint returns an error code");
    expect(severity).toBe("High");
  });

  it("falls back to Low severity for FeatureRequest when only FeatureRequest keywords match", () => {
    // "improve" is in FeatureRequest keywords but NOT in any severity bucket.
    // No severity keywords fire, so the category-default path applies: FeatureRequest → Low.
    const { category, severity } = classifyTicket("Improve the onboarding", "The onboarding roadmap could be improved");
    expect(category).toBe("FeatureRequest");
    expect(severity).toBe("Low");
  });

  it("returns High default severity for Bug with no severity keywords", () => {
    const { severity } = classifyTicket("Deploy problem", "The deployment is failing");
    expect(severity).toBe("High");
  });

  it("returns Medium default severity for AccountIssue with no severity keywords", () => {
    // Use keywords that trigger AccountIssue but not any severity bucket
    const { severity } = classifyTicket("Profile update", "I need to update my username and profile");
    expect(severity).toBe("Medium");
  });
});

// ── matchKnowledgeBase ────────────────────────────────────────────────────────

describe("matchKnowledgeBase", () => {
  it("returns a match result for a related ticket and article", () => {
    const ticket = makeTicket({
      title: "Password reset not working",
      description: "I clicked forgot password and reset my login credentials but it failed",
      category: "AccountIssue",
    });
    const article = makeArticle();
    const result = matchKnowledgeBase(ticket, [article]);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });

  it("returns a higher score for a closely matching article than an unrelated one", () => {
    const ticket = makeTicket({
      title: "Password reset not working",
      description: "I clicked forgot password and reset my login credentials",
      category: "AccountIssue",
    });
    const relatedArticle = makeArticle();
    const unrelatedArticle = makeArticle({
      id: "kb-unrelated",
      title: "Wire transfer limits",
      content: "International wire transfers are subject to FINTRAC reporting requirements.",
      tags: ["wire", "transfer", "fintrac"],
      category: "Bug",
    });
    const relatedResult = matchKnowledgeBase(ticket, [relatedArticle]);
    const unrelatedResult = matchKnowledgeBase(ticket, [unrelatedArticle]);
    expect(relatedResult!.score).toBeGreaterThan(unrelatedResult!.score);
  });

  it("returns null when the article list is empty", () => {
    const ticket = makeTicket();
    const result = matchKnowledgeBase(ticket, []);
    expect(result).toBeNull();
  });

  it("returns the best-matching article when multiple are provided", () => {
    const ticket = makeTicket({
      title: "API key returns 401 unauthorized",
      description: "All API requests fail with 401 unauthorized since this morning",
      category: "Bug",
    });
    const apiArticle = makeArticle({
      id: "kb-api",
      title: "API Authentication and API Keys",
      content: "All API requests must include your API key in the Authorization header as a Bearer token.",
      tags: ["api", "key", "authentication", "bearer", "token", "401", "unauthorized"],
      category: "HowTo",
    });
    const passwordArticle = makeArticle();
    const result = matchKnowledgeBase(ticket, [passwordArticle, apiArticle]);
    expect(result).not.toBeNull();
    expect(result!.article.id).toBe("kb-api");
  });

  it("category boost raises score for same-category articles", () => {
    const ticket = makeTicket({
      title: "Password reset problem",
      description: "I cannot reset my login password",
      category: "AccountIssue",
    });
    const sameCategoryArticle = makeArticle({ id: "kb-same", category: "AccountIssue" });
    const diffCategoryArticle = makeArticle({ id: "kb-diff", category: "Bug" });

    const sameResult = matchKnowledgeBase(ticket, [sameCategoryArticle]);
    const diffResult = matchKnowledgeBase(ticket, [diffCategoryArticle]);
    expect(sameResult!.score).toBeGreaterThanOrEqual(diffResult!.score);
  });
});

// ── processTicket ─────────────────────────────────────────────────────────────

describe("processTicket", () => {
  it("auto-resolves when best match score exceeds threshold (0.3)", () => {
    // Use a ticket and article with very high token overlap
    const ticket = makeTicket({
      title: "Password reset forgot login account credentials",
      description: "I need to reset my password. I forgot my login credentials for my account. Please help me reset.",
    });
    const article = makeArticle({
      title: "How to reset your password and login account credentials",
      content:
        "To reset your password, go to the login page. Enter your account credentials. We will send a reset link. Your account login will be restored once you reset your forgotten credentials.",
      tags: ["password", "reset", "login", "account", "credentials", "forgot"],
      category: "AccountIssue",
    });

    const result = processTicket(ticket, [article]);
    expect(result.status).toBe("AutoResolved");
    expect(result.matchScore).toBeGreaterThan(0.3);
    expect(result.resolution).toBe(article.content);
    expect(result.matchedArticle).toEqual(article);
  });

  it("escalates when best match score is at or below threshold (0.3)", () => {
    const ticket = makeTicket({
      title: "Zeppelin configuration override",
      description: "Totally unrelated query about zeppelin override settings nobody knows about",
    });
    const article = makeArticle({
      title: "Wire transfer limits",
      content: "International wire transfers are subject to FINTRAC reporting requirements.",
      tags: ["wire", "transfer", "fintrac"],
      category: "Bug",
    });

    const result = processTicket(ticket, [article]);
    expect(result.status).toBe("Escalated");
    expect(result.matchScore).toBeLessThanOrEqual(0.3);
    expect(result.resolution).toBeNull();
  });

  it("escalates when no articles are provided", () => {
    const ticket = makeTicket({ title: "Some issue", description: "Description here" });
    const result = processTicket(ticket, []);
    expect(result.status).toBe("Escalated");
    expect(result.matchScore).toBe(0);
    expect(result.matchedArticle).toBeNull();
  });

  it("returned category and severity are populated", () => {
    const ticket = makeTicket({
      title: "App crash",
      description: "The application crashes on login",
    });
    const result = processTicket(ticket, []);
    expect(result.category).toBeTruthy();
    expect(result.severity).toBeTruthy();
  });
});
