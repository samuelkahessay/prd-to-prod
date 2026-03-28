// ── Compliance Scanner — deterministic rule-based engine ─────────────────────
// Aligned to the original C# ComplianceRuleLibrary.cs from Run 05 (v5.0.0).
// 9 rules with PIPEDA/FINTRAC citations. No LLM calls. Fully synchronous.

export type ComplianceDisposition = "AUTO_BLOCK" | "HUMAN_REQUIRED" | "ADVISORY";
export type ComplianceRegulation = "PIPEDA" | "FINTRAC";
export type FindingSeverity = "Low" | "Medium" | "High" | "Critical";
export type ContentType = "CODE" | "DIFF" | "LOG" | "FREETEXT";

export interface ComplianceFinding {
  id: string;
  regulation: ComplianceRegulation;
  severity: FindingSeverity;
  disposition: ComplianceDisposition;
  ruleId: string;
  description: string;
  citation?: string;
  lineNumber?: number;
  codeSnippet?: string;
}

export interface ScanResult {
  disposition: ComplianceDisposition;
  findings: ComplianceFinding[];
}

// ── ID helper ─────────────────────────────────────────────────────────────────

function findingId(): string {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Rule definitions ──────────────────────────────────────────────────────────

interface Rule {
  id: string;
  regulation: ComplianceRegulation;
  severity: FindingSeverity;
  disposition: ComplianceDisposition;
  description: string;
  citation: string;
  pattern?: RegExp;
  matcher?: (content: string, lines: string[]) => MatchDetails | null;
  contentTypes?: ContentType[];
}

interface MatchDetails {
  lineNumber?: number;
  codeSnippet?: string;
}

const TRANSACTION_CONTEXT =
  /\b(transaction|transfer|payment|wire|deposit|withdrawal|cash|beneficiary)\b/i;
const REPORTING_MARKERS = /\b(fintrac_reported|suspicious_flag|ctr_required)\b/i;

function clippedLine(line: string): string {
  return line.trim().slice(0, 120);
}

function matchLine(lines: string[], predicate: (line: string) => boolean): MatchDetails | null {
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i])) {
      return {
        lineNumber: i + 1,
        codeSnippet: clippedLine(lines[i]),
      };
    }
  }

  return null;
}

function hasLargeTransactionAmount(text: string): boolean {
  const matches = text.matchAll(
    /\$?\s*((?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d{2})?\s*(cad|usd|dollars?)?/gi
  );

  for (const match of matches) {
    const rawAmount = match[1];
    const hasCurrencyMarker = match[0].includes("$") || Boolean(match[2]);

    if (!hasCurrencyMarker) {
      continue;
    }

    const amount = Number(rawAmount.replaceAll(",", ""));
    if (amount > 10_000) {
      return true;
    }
  }

  return false;
}

// ── Rules aligned to ComplianceRuleLibrary.cs (v5.0.0) ──────────────────────

const RULES: Rule[] = [
  // ── PIPEDA rules ──────────────────────────────────────────────────────────

  {
    id: "PIPEDA-001",
    regulation: "PIPEDA",
    severity: "Critical",
    disposition: "AUTO_BLOCK",
    description:
      "Social Insurance Number (SIN) in plaintext — direct PII disclosure prohibited",
    citation: "PIPEDA s.5(3)",
    // Canadian SIN: 9 digits optionally separated by spaces or dashes
    pattern: /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/,
  },
  {
    id: "PIPEDA-002",
    regulation: "PIPEDA",
    severity: "High",
    disposition: "HUMAN_REQUIRED",
    description:
      "Account number exposure — financial identifiers require safeguards before processing",
    citation: "PIPEDA s.4.7",
    pattern: /\b(account[_\s]?(number|no|#|id)|acct[_\s]?#?)\s*[:=]?\s*\d{5,}/i,
  },
  {
    id: "PIPEDA-003",
    regulation: "PIPEDA",
    severity: "High",
    disposition: "HUMAN_REQUIRED",
    description:
      "Date of birth in log or code context — constitutes personal information requiring consent",
    citation: "PIPEDA s.4.3",
    pattern:
      /\b(dob|date[_\s]?of[_\s]?birth|birth[_\s]?date|born[_\s]?on)\b/i,
    contentTypes: ["LOG", "CODE", "DIFF"],
  },
  {
    id: "PIPEDA-005",
    regulation: "PIPEDA",
    severity: "Medium",
    disposition: "ADVISORY",
    description:
      "Email address in plaintext — personal information that should be handled per privacy policy",
    citation: "PIPEDA Principle 4.3",
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  },
  {
    id: "PIPEDA-007",
    regulation: "PIPEDA",
    severity: "Critical",
    disposition: "AUTO_BLOCK",
    description:
      "Credit card number unmasked — payment card data must be encrypted or tokenized",
    citation: "PIPEDA s.4.7",
    // Matches 13-19 digit card numbers (Visa, MC, Amex patterns)
    pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{1,7}\b/,
  },
  {
    id: "PIPEDA-008",
    regulation: "PIPEDA",
    severity: "Critical",
    disposition: "AUTO_BLOCK",
    description:
      "Health or medical information detected — sensitive personal information requiring explicit consent",
    citation: "PIPEDA s.4.3.4",
    pattern:
      /\b(health[_\s]?record|medical[_\s]?data|diagnosis|prescription|patient[_\s]?id)\b/i,
  },

  // ── FINTRAC rules ─────────────────────────────────────────────────────────

  {
    id: "FINTRAC-001",
    regulation: "FINTRAC",
    severity: "High",
    disposition: "HUMAN_REQUIRED",
    description:
      "Large transaction exceeding $10,000 threshold without reporting flag — mandatory reporting required",
    citation: "Proceeds of Crime Act s.9",
    matcher: (_content, lines) =>
      matchLine(
        lines,
        (line) =>
          TRANSACTION_CONTEXT.test(line) &&
          hasLargeTransactionAmount(line) &&
          !REPORTING_MARKERS.test(line)
      ),
  },
  {
    id: "FINTRAC-002",
    regulation: "FINTRAC",
    severity: "Critical",
    disposition: "AUTO_BLOCK",
    description:
      "Suspicious Activity Report (SAR) bypass — explicit circumvention of reporting obligations",
    citation: "PCMLTFA s.7",
    pattern:
      /\b(skip[_\s]?sar|bypass[_\s]?report|disable[_\s]?alert|suppress[_\s]?suspicious|no[_\s]?sar)\b/i,
  },
  {
    id: "FINTRAC-005",
    regulation: "FINTRAC",
    severity: "High",
    disposition: "HUMAN_REQUIRED",
    description:
      "Cash transaction without Currency Transaction Report (CTR) reference — requires mandatory filing",
    citation: "PCMLTFA s.9(1)",
    matcher: (_content, lines) =>
      matchLine(
        lines,
        (line) =>
          /\bcash\b/i.test(line) &&
          TRANSACTION_CONTEXT.test(line) &&
          !/\bctr\b/i.test(line) &&
          !REPORTING_MARKERS.test(line)
      ),
  },
];

// ── Scanner ───────────────────────────────────────────────────────────────────

export function scanContent(
  content: string,
  contentType: ContentType
): ScanResult {
  const lines = content.split("\n");
  const findings: ComplianceFinding[] = [];
  const firedRules = new Set<string>();

  for (const rule of RULES) {
    // Skip rules that don't apply to this content type
    if (rule.contentTypes && !rule.contentTypes.includes(contentType)) {
      continue;
    }

    if (rule.matcher) {
      const match = rule.matcher(content, lines);

      if (match && !firedRules.has(rule.id)) {
        firedRules.add(rule.id);
        findings.push({
          id: findingId(),
          regulation: rule.regulation,
          severity: rule.severity,
          disposition: rule.disposition,
          ruleId: rule.id,
          description: rule.description,
          citation: rule.citation,
          ...(match.lineNumber != null ? { lineNumber: match.lineNumber } : {}),
          ...(match.codeSnippet ? { codeSnippet: match.codeSnippet } : {}),
        });
      }

      continue;
    }

    if (!rule.pattern) {
      continue;
    }

    // Test line-by-line first to capture line numbers and snippets
    let ruleMatched = false;
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        if (!firedRules.has(rule.id)) {
          firedRules.add(rule.id);
          findings.push({
            id: findingId(),
            regulation: rule.regulation,
            severity: rule.severity,
            disposition: rule.disposition,
            ruleId: rule.id,
            description: rule.description,
            citation: rule.citation,
            lineNumber: i + 1,
            codeSnippet: clippedLine(lines[i]),
          });
          ruleMatched = true;
          break;
        }
      }
    }

    // If no line match, test full content (for multi-line patterns)
    if (!ruleMatched && !firedRules.has(rule.id) && rule.pattern.test(content)) {
      firedRules.add(rule.id);
      findings.push({
        id: findingId(),
        regulation: rule.regulation,
        severity: rule.severity,
        disposition: rule.disposition,
        ruleId: rule.id,
        description: rule.description,
        citation: rule.citation,
      });
    }
  }

  // ── Disposition classification ────────────────────────────────────────────
  // Critical findings → AUTO_BLOCK (no further review possible)
  // Any HUMAN_REQUIRED finding (and no AUTO_BLOCK) → HUMAN_REQUIRED
  // Otherwise → ADVISORY or CLEAN

  const disposition = classifyDisposition(findings);

  return { disposition, findings };
}

function classifyDisposition(findings: ComplianceFinding[]): ComplianceDisposition {
  if (findings.some((f) => f.disposition === "AUTO_BLOCK")) {
    return "AUTO_BLOCK";
  }
  if (findings.some((f) => f.disposition === "HUMAN_REQUIRED")) {
    return "HUMAN_REQUIRED";
  }
  // All advisory or no findings
  return "ADVISORY";
}
