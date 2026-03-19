import type { ComplianceScan } from "./store";

// ── Pre-seeded scans covering all four disposition paths ──────────────────────
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
  // TODO: verify consent before returning health data
  if (user.healthRecord) {
    logger.info(\`Fetching health_record for user \${userId} dob=\${user.dateOfBirth}\`);
    return { ...user, healthRecord: user.healthRecord };
  }
  return user;
}`,
    disposition: "HUMAN_REQUIRED",
    findings: [
      {
        id: "f-seed-1a",
        regulation: "PIPEDA",
        severity: "High",
        disposition: "HUMAN_REQUIRED",
        ruleId: "PIPEDA-006",
        description:
          "Health or medical data reference detected — sensitive personal information under PIPEDA s.4.3.4",
        lineNumber: 4,
        codeSnippet: "  if (user.healthRecord) {",
      },
      {
        id: "f-seed-1b",
        regulation: "PIPEDA",
        severity: "Medium",
        disposition: "ADVISORY",
        ruleId: "PIPEDA-005",
        description:
          "Consent gap: personal data collected without explicit opt-in reference — review PIPEDA Principle 3",
        lineNumber: 3,
        codeSnippet: "  // TODO: verify consent before returning health data",
      },
    ],
    // operatorDecision intentionally absent — this scan is PENDING
  },

  // 2. AUTO_BLOCK — critical findings, no operator action possible
  {
    id: "scan-seed-2",
    submittedAt: "2026-03-18T07:00:00Z",
    contentType: "LOG",
    sourceLabel: "payment-worker/worker.log",
    content: `[2026-03-18 06:58:01] INFO  Payment initiated: amount=15500 CAD customer=john.smith@acme.co
[2026-03-18 06:58:02] DEBUG KYC check skipped for returning customer
[2026-03-18 06:58:03] INFO  Wire transfer to IBAN DE89370400440532013000 completed
[2026-03-18 06:58:04] INFO  Crypto wallet 0xAbCd1234EfGh5678IjKl9012MnOp3456QrSt7890 funded`,
    disposition: "AUTO_BLOCK",
    findings: [
      {
        id: "f-seed-2a",
        regulation: "PIPEDA",
        severity: "Critical",
        disposition: "AUTO_BLOCK",
        ruleId: "PIPEDA-001",
        description:
          "Email address logged or stored in plaintext — PII exposure violates PIPEDA s.4.7",
        lineNumber: 1,
        codeSnippet:
          "[2026-03-18 06:58:01] INFO  Payment initiated: amount=15500 CAD customer=john.smith@acme.co",
      },
      {
        id: "f-seed-2b",
        regulation: "FINTRAC",
        severity: "High",
        disposition: "HUMAN_REQUIRED",
        ruleId: "FINTRAC-001",
        description:
          "Large cash transaction exceeding $10,000 threshold — mandatory reporting under Proceeds of Crime Act s.9",
        lineNumber: 1,
        codeSnippet:
          "[2026-03-18 06:58:01] INFO  Payment initiated: amount=15500 CAD customer=john.smith@acme.co",
      },
      {
        id: "f-seed-2c",
        regulation: "FINTRAC",
        severity: "Critical",
        disposition: "AUTO_BLOCK",
        ruleId: "FINTRAC-005",
        description:
          "Cryptocurrency transaction without FINTRAC registration — virtual asset service providers must register",
        lineNumber: 4,
        codeSnippet:
          "[2026-03-18 06:58:04] INFO  Crypto wallet 0xAbCd1234... funded",
      },
    ],
  },

  // 3. ADVISORY — low-risk patterns, no blocking or escalation needed
  {
    id: "scan-seed-3",
    submittedAt: "2026-03-17T14:30:00Z",
    contentType: "DIFF",
    sourceLabel: "compliance/retention-policy.ts",
    content: `+// Data retention: purge inactive accounts after 24 months (PIPEDA Principle 5)
+async function purgeStaleAccounts() {
+  const cutoff = subMonths(new Date(), 24);
+  const stale = await db.accounts.find({ lastActive: { $lt: cutoff } });
+  await db.accounts.deleteMany({ _id: { $in: stale.map(a => a._id) } });
+  logger.info(\`Purged \${stale.length} stale accounts\`);
+}`,
    disposition: "ADVISORY",
    findings: [
      {
        id: "f-seed-3a",
        regulation: "PIPEDA",
        severity: "Low",
        disposition: "ADVISORY",
        ruleId: "PIPEDA-007",
        description:
          "Data retention policy not referenced — PIPEDA Principle 5 requires defined retention schedules",
        lineNumber: 1,
        codeSnippet: "+// Data retention: purge inactive accounts after 24 months (PIPEDA Principle 5)",
      },
    ],
  },

  // 4. CLEAN — no findings
  {
    id: "scan-seed-4",
    submittedAt: "2026-03-17T09:00:00Z",
    contentType: "FREETEXT",
    sourceLabel: "Q1 audit summary",
    content: `Quarterly compliance review complete. All pipeline workflows reviewed for data handling.
No personal data stored beyond session duration. No financial transaction processing in scope.
Authentication handled via OAuth 2.0 with third-party provider. No direct PII collection.`,
    disposition: "ADVISORY",
    findings: [],
  },
];
