import type { Ticket, KnowledgeArticle, TicketCategory, TicketSeverity } from "./store";

// ── Tokenizer ──────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      // Strip punctuation (same fix as PR #196 in the original ASP.NET run)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

// ── Jaccard similarity ─────────────────────────────────────────────────────

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Category keyword rules ─────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<TicketCategory, string[]> = {
  AccountIssue: [
    "account",
    "login",
    "password",
    "reset",
    "locked",
    "lockout",
    "sign",
    "signin",
    "authenticate",
    "authentication",
    "2fa",
    "mfa",
    "two-factor",
    "access",
    "credentials",
    "username",
    "email",
    "profile",
    "security",
  ],
  Bug: [
    "error",
    "bug",
    "broken",
    "fail",
    "failed",
    "crash",
    "exception",
    "500",
    "404",
    "401",
    "403",
    "429",
    "issue",
    "problem",
    "not working",
    "wrong",
    "incorrect",
    "unexpected",
    "deploy",
    "deployment",
  ],
  FeatureRequest: [
    "feature",
    "request",
    "add",
    "support",
    "would be great",
    "suggestion",
    "idea",
    "enhancement",
    "improve",
    "improvement",
    "roadmap",
    "wish",
    "could you",
    "please add",
  ],
  HowTo: [
    "how",
    "where",
    "what",
    "can i",
    "how do",
    "how to",
    "setup",
    "configure",
    "install",
    "integrate",
    "connect",
    "enable",
    "disable",
    "export",
    "import",
    "guide",
    "documentation",
    "docs",
    "tutorial",
    "step",
  ],
  Other: [],
};

// ── Severity keyword rules ─────────────────────────────────────────────────

const SEVERITY_KEYWORDS: Record<TicketSeverity, string[]> = {
  Critical: [
    "critical",
    "urgent",
    "down",
    "outage",
    "production",
    "blocking",
    "blocked",
    "cannot",
    "all users",
    "data loss",
    "security breach",
    "immediately",
    "asap",
  ],
  High: [
    "high",
    "important",
    "failing",
    "broken",
    "cannot access",
    "not working",
    "error",
    "locked out",
    "release",
    "deployment",
  ],
  Medium: [
    "medium",
    "intermittent",
    "sometimes",
    "occasional",
    "slow",
    "feature",
    "would like",
    "would be",
    "request",
  ],
  Low: ["low", "minor", "cosmetic", "typo", "suggestion", "idea", "nice to have", "when possible"],
};

// ── Classifier ────────────────────────────────────────────────────────────

export function classifyTicket(
  title: string,
  description: string
): { category: TicketCategory; severity: TicketSeverity } {
  const text = `${title} ${description}`.toLowerCase();

  // Score each category
  const categoryScores: Record<TicketCategory, number> = {
    AccountIssue: 0,
    Bug: 0,
    FeatureRequest: 0,
    HowTo: 0,
    Other: 0,
  };

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TicketCategory, string[]][]) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        categoryScores[cat]++;
      }
    }
  }

  // Pick highest-scoring category (fallback: Other)
  let category: TicketCategory = "Other";
  let topCatScore = 0;
  for (const [cat, score] of Object.entries(categoryScores) as [TicketCategory, number][]) {
    if (cat === "Other") continue;
    if (score > topCatScore) {
      topCatScore = score;
      category = cat;
    }
  }

  // Score each severity
  const severityScores: Record<TicketSeverity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  for (const [sev, keywords] of Object.entries(SEVERITY_KEYWORDS) as [TicketSeverity, string[]][]) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        severityScores[sev]++;
      }
    }
  }

  // Pick highest-scoring severity (fallback by category)
  const SEVERITY_ORDER: TicketSeverity[] = ["Critical", "High", "Medium", "Low"];
  let severity: TicketSeverity = "Medium";
  let topSevScore = 0;
  for (const sev of SEVERITY_ORDER) {
    if (severityScores[sev] > topSevScore) {
      topSevScore = severityScores[sev];
      severity = sev;
    }
  }

  // Default severity by category if no severity keywords matched
  if (topSevScore === 0) {
    if (category === "FeatureRequest") severity = "Low";
    else if (category === "Bug") severity = "High";
    else if (category === "AccountIssue") severity = "Medium";
    else severity = "Low";
  }

  return { category, severity };
}

// ── Knowledge base matching ────────────────────────────────────────────────

export interface MatchResult {
  article: KnowledgeArticle;
  score: number;
}

export function matchKnowledgeBase(ticket: Ticket, articles: KnowledgeArticle[]): MatchResult | null {
  const ticketTokens = tokenize(`${ticket.title} ${ticket.description}`);
  let best: MatchResult | null = null;

  for (const article of articles) {
    const articleTokens = tokenize(
      `${article.title} ${article.content} ${article.tags.join(" ")}`
    );
    const score = jaccard(ticketTokens, articleTokens);

    // Boost score for same-category articles
    const catBoost = ticket.category && article.category === ticket.category ? 0.1 : 0;
    const finalScore = Math.min(1, score + catBoost);

    if (best === null || finalScore > best.score) {
      best = { article, score: finalScore };
    }
  }

  return best;
}

// ── Full pipeline ─────────────────────────────────────────────────────────

const AUTO_RESOLVE_THRESHOLD = 0.3;

export interface ProcessResult {
  category: TicketCategory;
  severity: TicketSeverity;
  status: "AutoResolved" | "Escalated";
  resolution: string | null;
  matchedArticle: KnowledgeArticle | null;
  matchScore: number;
}

export function processTicket(ticket: Ticket, articles: KnowledgeArticle[]): ProcessResult {
  const { category, severity } = classifyTicket(ticket.title, ticket.description);

  // Clone ticket with classification for matching
  const classified: Ticket = { ...ticket, category, severity };
  const match = matchKnowledgeBase(classified, articles);

  if (match && match.score >= AUTO_RESOLVE_THRESHOLD) {
    return {
      category,
      severity,
      status: "AutoResolved",
      resolution: match.article.content,
      matchedArticle: match.article,
      matchScore: match.score,
    };
  }

  return {
    category,
    severity,
    status: "Escalated",
    resolution: null,
    matchedArticle: match?.article ?? null,
    matchScore: match?.score ?? 0,
  };
}
