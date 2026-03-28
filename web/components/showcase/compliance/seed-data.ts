import type { ComplianceScan } from "./store";

// ── Pre-seeded scans aligned to the C# ComplianceRuleLibrary.cs rules ────────
// Key demo requirement: at least one HUMAN_REQUIRED scan awaiting operator decision.

export const SEED_SCANS: ComplianceScan[] = [
  // 1. HUMAN_REQUIRED — awaiting operator decision (the key demo moment)
  {
    id: "scan-seed-1",
    submittedAt: "2026-03-18T08:15:00Z",
    contentType: "CODE",
    sourceLabel: "user-service/profile.ts",
    content: `async function getUserProfile(userId: string) {
  const user = await db.users.findOne({ id: userId });
  if (user.healthRecord) {
    logger.info(\`Fetching health_record for user \${userId} dob=\${user.dateOfBirth}\`);
    return { ...user, healthRecord: user.healthRecord };
  }
  // Customer account_number: 7891234 is logged for debugging
  const acctInfo = \`account_number: \${user.accountNumber}\`;
  return user;
}`,
    disposition: "AUTO_BLOCK",
    findings: [
      {
        id: "f-seed-1a",
        regulation: "PIPEDA",
        severity: "Critical",
        disposition: "AUTO_BLOCK",
        ruleId: "PIPEDA-008",
        description:
          "Health or medical information detected — sensitive personal information requiring explicit consent",
        citation: "PIPEDA s.4.3.4",
        lineNumber: 3,
        codeSnippet: "  if (user.healthRecord) {",
      },
      {
        id: "f-seed-1b",
        regulation: "PIPEDA",
        severity: "High",
        disposition: "HUMAN_REQUIRED",
        ruleId: "PIPEDA-003",
        description:
          "Date of birth in log or code context — constitutes personal information requiring consent",
        citation: "PIPEDA s.4.3",
        lineNumber: 4,
        codeSnippet: "    logger.info(`Fetching health_record for user ${userId} dob=${user.dateOfBirth}`);",
      },
      {
        id: "f-seed-1c",
        regulation: "PIPEDA",
        severity: "High",
        disposition: "HUMAN_REQUIRED",
        ruleId: "PIPEDA-002",
        description:
          "Account number exposure — financial identifiers require safeguards before processing",
        citation: "PIPEDA s.4.7",
        lineNumber: 8,
        codeSnippet: "  // Customer account_number: 7891234 is logged for debugging",
      },
    ],
  },

  // 2. AUTO_BLOCK — SIN + credit card, no operator action possible
  {
    id: "scan-seed-2",
    submittedAt: "2026-03-18T07:00:00Z",
    contentType: "LOG",
    sourceLabel: "payment-worker/worker.log",
    content: `[2026-03-18 06:58:01] INFO  Customer onboarding: SIN 456 789 012 verified
[2026-03-18 06:58:02] INFO  Payment card: 4532-1234-5678-9012 charged $15,500 CAD
[2026-03-18 06:58:03] INFO  Cash deposit $12,000 CAD for beneficiary without ctr_required
[2026-03-18 06:58:04] INFO  Contact: customer@acme.co for receipt`,
    disposition: "AUTO_BLOCK",
    findings: [
      {
        id: "f-seed-2a",
        regulation: "PIPEDA",
        severity: "Critical",
        disposition: "AUTO_BLOCK",
        ruleId: "PIPEDA-001",
        description:
          "Social Insurance Number (SIN) in plaintext — direct PII disclosure prohibited",
        citation: "PIPEDA s.5(3)",
        lineNumber: 1,
        codeSnippet:
          "[2026-03-18 06:58:01] INFO  Customer onboarding: SIN 456 789 012 verified",
      },
      {
        id: "f-seed-2b",
        regulation: "PIPEDA",
        severity: "Critical",
        disposition: "AUTO_BLOCK",
        ruleId: "PIPEDA-007",
        description:
          "Credit card number unmasked — payment card data must be encrypted or tokenized",
        citation: "PIPEDA s.4.7",
        lineNumber: 2,
        codeSnippet:
          "[2026-03-18 06:58:02] INFO  Payment card: 4532-1234-5678-9012 charged $15,500 CAD",
      },
      {
        id: "f-seed-2c",
        regulation: "PIPEDA",
        severity: "Medium",
        disposition: "ADVISORY",
        ruleId: "PIPEDA-005",
        description:
          "Email address in plaintext — personal information that should be handled per privacy policy",
        citation: "PIPEDA Principle 4.3",
        lineNumber: 4,
        codeSnippet:
          "[2026-03-18 06:58:04] INFO  Contact: customer@acme.co for receipt",
      },
      {
        id: "f-seed-2d",
        regulation: "FINTRAC",
        severity: "High",
        disposition: "HUMAN_REQUIRED",
        ruleId: "FINTRAC-001",
        description:
          "Large transaction exceeding $10,000 threshold without reporting flag — mandatory reporting required",
        citation: "Proceeds of Crime Act s.9",
        lineNumber: 2,
        codeSnippet:
          "[2026-03-18 06:58:02] INFO  Payment card: 4532-1234-5678-9012 charged $15,500 CAD",
      },
    ],
  },

  // 3. HUMAN_REQUIRED — FINTRAC cash without CTR (pending operator decision)
  {
    id: "scan-seed-3",
    submittedAt: "2026-03-17T14:30:00Z",
    contentType: "LOG",
    sourceLabel: "teller-system/daily-log.txt",
    content: `[2026-03-17 14:22:00] INFO  Cash withdrawal $8,500 CAD processed at branch 004
[2026-03-17 14:25:00] INFO  Cash deposit $11,200 CAD for beneficiary account transfer
[2026-03-17 14:28:00] INFO  Wire transfer $25,000 USD to IBAN DE89370400440532013000`,
    disposition: "HUMAN_REQUIRED",
    findings: [
      {
        id: "f-seed-3a",
        regulation: "FINTRAC",
        severity: "High",
        disposition: "HUMAN_REQUIRED",
        ruleId: "FINTRAC-005",
        description:
          "Cash transaction without Currency Transaction Report (CTR) reference — requires mandatory filing",
        citation: "PCMLTFA s.9(1)",
        lineNumber: 2,
        codeSnippet: "[2026-03-17 14:25:00] INFO  Cash deposit $11,200 CAD for beneficiary account transfer",
      },
      {
        id: "f-seed-3b",
        regulation: "FINTRAC",
        severity: "High",
        disposition: "HUMAN_REQUIRED",
        ruleId: "FINTRAC-001",
        description:
          "Large transaction exceeding $10,000 threshold without reporting flag — mandatory reporting required",
        citation: "Proceeds of Crime Act s.9",
        lineNumber: 2,
        codeSnippet: "[2026-03-17 14:25:00] INFO  Cash deposit $11,200 CAD for beneficiary account transfer",
      },
    ],
    // operatorDecision intentionally absent — this scan is PENDING
  },

  // 4. ADVISORY — email only, no blocking findings
  {
    id: "scan-seed-4",
    submittedAt: "2026-03-17T09:00:00Z",
    contentType: "FREETEXT",
    sourceLabel: "Q1 audit summary",
    content: `Quarterly compliance review complete. All pipeline workflows reviewed for data handling.
Please contact compliance-team@acme.co for questions about the retention schedule.
No SIN, health records, or financial identifiers found in application logs.
Authentication handled via OAuth 2.0 with third-party provider.`,
    disposition: "ADVISORY",
    findings: [
      {
        id: "f-seed-4a",
        regulation: "PIPEDA",
        severity: "Medium",
        disposition: "ADVISORY",
        ruleId: "PIPEDA-005",
        description:
          "Email address in plaintext — personal information that should be handled per privacy policy",
        citation: "PIPEDA Principle 4.3",
        lineNumber: 2,
        codeSnippet: "Please contact compliance-team@acme.co for questions about the retention schedule.",
      },
    ],
  },
];
