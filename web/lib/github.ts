import type { EvidenceRow, EvidenceOutcome } from "./types";

const REPO = process.env.GITHUB_REPO || "samuelkahessay/prd-to-prod";

interface GitHubIssue {
  number: number;
  title: string;
  created_at: string;
  labels: { name: string }[];
  pull_request?: { html_url: string };
  html_url: string;
  state: string;
}

interface GitHubPR {
  number: number;
  title: string;
  created_at: string;
  merged_at: string | null;
  html_url: string;
  labels: { name: string }[];
  user: { login: string };
  body?: string;
}

async function githubFetch<T>(endpoint: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN || "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

function classifyOutcome(
  issue: GitHubIssue,
  pr: GitHubPR | null
): EvidenceOutcome {
  const labels = issue.labels.map((l) => l.name);
  if (labels.includes("drill")) return "drill";
  if (labels.includes("bug") && pr?.merged_at) return "healed";
  if (pr?.merged_at) return "merged";
  if (issue.state === "open") return "running";
  return "merged";
}

function formatDuration(start: string, end: string | null): string | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (d.toDateString() === now.toDateString()) return `${time} today`;
  return `${day} ${time}`;
}

export async function fetchEvidenceData(): Promise<EvidenceRow[]> {
  try {
    const [issues, prs] = await Promise.all([
      githubFetch<GitHubIssue[]>(
        `/repos/${REPO}/issues?labels=pipeline&state=all&sort=created&direction=desc&per_page=10`
      ),
      githubFetch<GitHubPR[]>(
        `/repos/${REPO}/pulls?state=all&sort=created&direction=desc&per_page=20`
      ),
    ]);

    const prByTitle = new Map<string, GitHubPR>();
    for (const pr of prs) {
      prByTitle.set(pr.title.toLowerCase(), pr);
    }

    const rows: EvidenceRow[] = [];

    for (const issue of issues.slice(0, 8)) {
      const matchingPr =
        prs.find(
          (pr) =>
            pr.title.toLowerCase().includes(`#${issue.number}`) ||
            pr.body?.includes(`#${issue.number}`)
        ) || null;

      const outcome = classifyOutcome(issue, matchingPr);
      const refs: EvidenceRow["refs"] = [
        {
          label: `#${issue.number}`,
          url: issue.html_url,
          type: outcome === "healed" ? "heal" : "issue",
        },
      ];

      if (matchingPr) {
        refs.push({
          label: `PR #${matchingPr.number}`,
          url: matchingPr.html_url,
          type: outcome === "healed" ? "heal" : "pr",
        });
      }

      rows.push({
        time: formatTime(issue.created_at),
        event: issue.title,
        refs,
        duration: matchingPr
          ? formatDuration(issue.created_at, matchingPr.merged_at)
          : null,
        outcome,
      });
    }

    return rows;
  } catch (error) {
    console.error("Failed to fetch evidence data:", error);
    return [];
  }
}
