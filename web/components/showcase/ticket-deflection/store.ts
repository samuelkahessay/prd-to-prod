"use client";

import { useState, useEffect, useCallback } from "react";
import { SEED_ARTICLES, SEED_TICKETS } from "./seed-data";
import { processTicket } from "./classifier";

// ── Types ──────────────────────────────────────────────────────────────────

export type TicketCategory = "Bug" | "FeatureRequest" | "HowTo" | "AccountIssue" | "Other";
export type TicketSeverity = "Low" | "Medium" | "High" | "Critical";
export type TicketStatus = "New" | "Classified" | "Matched" | "AutoResolved" | "Escalated";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory | null;
  severity: TicketSeverity | null;
  status: TicketStatus;
  resolution: string | null;
  createdAt: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: TicketCategory;
}

export interface ActivityLogEntry {
  id: string;
  ticketId: string;
  action: string;
  details: string;
  timestamp: string;
}

// ── Storage keys ───────────────────────────────────────────────────────────

const KEYS = {
  tickets: "td-showcase-tickets",
  articles: "td-showcase-articles",
  activity: "td-showcase-activity",
  seeded: "td-showcase-seeded",
};

// ── Storage helpers ───────────────────────────────────────────────────────

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ── ID generator ──────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Simulation templates ───────────────────────────────────────────────────

const SIM_TEMPLATES: { title: string; description: string }[] = [
  {
    title: "Password reset email not arriving",
    description:
      "I requested a password reset 30 minutes ago but have not received the email. I have checked spam and all folders.",
  },
  {
    title: "API key suddenly returns 401",
    description:
      "All our API calls started failing with 401 Unauthorized this morning. The key was working fine yesterday. We have not changed anything.",
  },
  {
    title: "Request: CSV export for audit logs",
    description:
      "Our compliance team needs to export audit logs in CSV format on a monthly basis. The current UI export is manual and time-consuming.",
  },
  {
    title: "Deployment health check fails",
    description:
      "Every deployment to production fails at the health check stage. The error says 'connection refused'. Our app works in staging.",
  },
  {
    title: "How do I connect Slack integration?",
    description:
      "I want to receive pipeline notifications in our Slack channel. I found the integrations page but the steps are not clear.",
  },
  {
    title: "Getting rate limited at 600 req/min",
    description:
      "We are on the standard plan and hitting rate limit errors even though we are well below 1000 req/min. Something seems wrong with the counter.",
  },
  {
    title: "Account locked after 2FA setup",
    description:
      "I enabled two-factor authentication and now I cannot log in. The authenticator app shows a code but the login page rejects it.",
  },
  {
    title: "Where do I find the billing invoice for last month?",
    description:
      "I need last month's invoice for a reimbursement claim. I have looked in the settings but cannot find the billing history.",
  },
  {
    title: "Feature request: webhook retry configuration",
    description:
      "When our webhook endpoint is temporarily down, we lose events. Being able to configure the retry count and delay would prevent data loss.",
  },
  {
    title: "500 error on bulk data export",
    description:
      "Trying to export our full dataset results in a 500 Internal Server Error. Smaller exports work fine. This might be a timeout issue.",
  },
  {
    title: "How to set up API authentication?",
    description:
      "Just getting started with your API. Can you explain how to authenticate? I see mention of Bearer tokens but I am not sure how to generate one.",
  },
  {
    title: "Request: mobile app for the dashboard",
    description:
      "Our team is often on the go and having a mobile app with the key metrics from the dashboard would be very useful.",
  },
];

// ── Main hook ─────────────────────────────────────────────────────────────

export function useTicketStore() {
  // SSR-safe: initialize with empty arrays, hydrate in useEffect
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ── Hydrate from localStorage on first mount ─────────────────────────

  useEffect(() => {
    const seeded = localStorage.getItem(KEYS.seeded);

    if (seeded) {
      setTickets(load<Ticket[]>(KEYS.tickets) ?? []);
      setArticles(load<KnowledgeArticle[]>(KEYS.articles) ?? SEED_ARTICLES);
      setActivityLog(load<ActivityLogEntry[]>(KEYS.activity) ?? []);
    } else {
      // First visit — seed everything
      const seedActivity: ActivityLogEntry[] = SEED_TICKETS.map((t) => ({
        id: uid("log"),
        ticketId: t.id,
        action: t.status === "AutoResolved" ? "AutoResolved" : "Escalated",
        details:
          t.status === "AutoResolved"
            ? `Ticket auto-resolved via knowledge base match.`
            : `Ticket escalated to human agent.`,
        timestamp: new Date(new Date(t.createdAt).getTime() + 5000).toISOString(),
      }));

      save(KEYS.tickets, SEED_TICKETS);
      save(KEYS.articles, SEED_ARTICLES);
      save(KEYS.activity, seedActivity);
      localStorage.setItem(KEYS.seeded, "1");

      setTickets(SEED_TICKETS);
      setArticles(SEED_ARTICLES);
      setActivityLog(seedActivity);
    }

    setHydrated(true);
  }, []);

  // ── Persist helpers ──────────────────────────────────────────────────

  function persistTickets(t: Ticket[]) {
    save(KEYS.tickets, t);
    setTickets(t);
  }

  function persistActivity(log: ActivityLogEntry[]) {
    save(KEYS.activity, log);
    setActivityLog(log);
  }

  // ── Submit a new ticket and run the full pipeline ────────────────────

  const submitTicket = useCallback(
    (title: string, description: string) => {
      const newTicket: Ticket = {
        id: uid("ticket"),
        title,
        description,
        category: null,
        severity: null,
        status: "New",
        resolution: null,
        createdAt: new Date().toISOString(),
      };

      const result = processTicket(newTicket, articles);

      const finalTicket: Ticket = {
        ...newTicket,
        category: result.category,
        severity: result.severity,
        status: result.status,
        resolution: result.resolution,
      };

      const now = new Date().toISOString();
      const newLogs: ActivityLogEntry[] = [
        {
          id: uid("log"),
          ticketId: newTicket.id,
          action: "Created",
          details: `New ticket submitted: "${title}"`,
          timestamp: now,
        },
        {
          id: uid("log"),
          ticketId: newTicket.id,
          action: "Classified",
          details: `Category: ${result.category} · Severity: ${result.severity}`,
          timestamp: now,
        },
        {
          id: uid("log"),
          ticketId: newTicket.id,
          action: result.status,
          details:
            result.status === "AutoResolved"
              ? `Auto-resolved via knowledge base (match score: ${(result.matchScore * 100).toFixed(0)}%)`
              : `No strong knowledge base match (best score: ${(result.matchScore * 100).toFixed(0)}%). Escalated to human agent.`,
          timestamp: now,
        },
      ];

      setTickets((prev) => {
        const updated = [finalTicket, ...prev];
        save(KEYS.tickets, updated);
        return updated;
      });

      setActivityLog((prev) => {
        const updated = [...newLogs, ...prev];
        save(KEYS.activity, updated);
        return updated;
      });
    },
    [articles]
  );

  // ── Simulate a batch of tickets ──────────────────────────────────────

  const simulateTickets = useCallback(() => {
    const count = Math.floor(Math.random() * 6) + 5; // 5–10

    // Shuffle templates and pick `count` of them
    const shuffled = [...SIM_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);

    const newTickets: Ticket[] = [];
    const newLogs: ActivityLogEntry[] = [];

    for (const template of shuffled) {
      const ticket: Ticket = {
        id: uid("ticket"),
        title: template.title,
        description: template.description,
        category: null,
        severity: null,
        status: "New",
        resolution: null,
        createdAt: new Date().toISOString(),
      };

      const result = processTicket(ticket, articles);
      const finalTicket: Ticket = {
        ...ticket,
        category: result.category,
        severity: result.severity,
        status: result.status,
        resolution: result.resolution,
      };

      newTickets.push(finalTicket);

      const now = new Date().toISOString();
      newLogs.push(
        {
          id: uid("log"),
          ticketId: ticket.id,
          action: "Created",
          details: `Simulated ticket: "${template.title}"`,
          timestamp: now,
        },
        {
          id: uid("log"),
          ticketId: ticket.id,
          action: "Classified",
          details: `Category: ${result.category} · Severity: ${result.severity}`,
          timestamp: now,
        },
        {
          id: uid("log"),
          ticketId: ticket.id,
          action: result.status,
          details:
            result.status === "AutoResolved"
              ? `Auto-resolved (score: ${(result.matchScore * 100).toFixed(0)}%)`
              : `Escalated (score: ${(result.matchScore * 100).toFixed(0)}%)`,
          timestamp: now,
        }
      );
    }

    setTickets((prev) => {
      const updated = [...newTickets, ...prev];
      save(KEYS.tickets, updated);
      return updated;
    });

    setActivityLog((prev) => {
      const updated = [...newLogs, ...prev];
      save(KEYS.activity, updated);
      return updated;
    });
  }, [articles]);

  // ── Clear all tickets ─────────────────────────────────────────────────

  const clearTickets = useCallback(() => {
    persistTickets([]);
    persistActivity([]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    tickets,
    articles,
    activityLog,
    hydrated,
    submitTicket,
    simulateTickets,
    clearTickets,
  };
}
