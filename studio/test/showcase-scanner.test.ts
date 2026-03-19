import { scanContent } from "@/components/showcase/compliance/scanner";
import type { ContentType } from "@/components/showcase/compliance/scanner";

// ── PIPEDA rules ──────────────────────────────────────────────────────────────

describe("scanContent — PIPEDA: email PII detection", () => {
  it("finds an email address in LOG content and reports PIPEDA", () => {
    const log = "2026-03-18T10:00:00Z [INFO] User logged in: jane.doe@example.com from 192.168.1.1";
    const result = scanContent(log, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-001");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("PIPEDA");
    expect(finding!.severity).toBe("Critical");
  });

  it("finds an email address in CODE content and reports PIPEDA", () => {
    const code = `const adminEmail = "admin@company.org";\nconsole.log(adminEmail);`;
    const result = scanContent(code, "CODE");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-001");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("PIPEDA");
  });

  it("does NOT fire PIPEDA-001 for FREETEXT content type", () => {
    const text = "Contact me at user@domain.com for more information.";
    const result = scanContent(text, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-001");
    expect(finding).toBeUndefined();
  });
});

describe("scanContent — PIPEDA: SIN pattern detection", () => {
  it("finds a Social Insurance Number (SIN) in any content type", () => {
    const content = "Customer SIN on file: 123-456-789";
    const result = scanContent(content, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-002");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("PIPEDA");
    expect(finding!.severity).toBe("Critical");
  });

  it("finds a SIN without separators", () => {
    const content = "SIN: 123456789 stored in user record";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-002");
    expect(finding).toBeDefined();
  });

  it("includes the line number when a match is found on a specific line", () => {
    const content = "Line one.\nLine two with SIN 987 654 321 here.\nLine three.";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-002");
    expect(finding).toBeDefined();
    expect(finding!.lineNumber).toBe(2);
  });
});

describe("scanContent — PIPEDA: credential exposure", () => {
  it("finds a plaintext password assignment in code", () => {
    const code = `const password = "supersecret123";\ndb.connect(password);`;
    const result = scanContent(code, "CODE");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-004");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("PIPEDA");
    expect(finding!.severity).toBe("High");
  });
});

// ── FINTRAC rules ─────────────────────────────────────────────────────────────

describe("scanContent — FINTRAC: large transaction detection", () => {
  it("finds a transaction exceeding $10,000 and reports FINTRAC", () => {
    const log = "Transaction processed: $12,500 deposit from account 88271";
    const result = scanContent(log, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-001");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("FINTRAC");
    expect(finding!.severity).toBe("High");
    expect(finding!.disposition).toBe("HUMAN_REQUIRED");
  });

  it("finds a large numeric amount without currency symbol", () => {
    const content = "Transfer of 15000 CAD initiated by customer";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-001");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("FINTRAC");
  });

  it("does not treat arbitrary 5-digit numbers as reportable transactions", () => {
    const content = "build id 12345 completed successfully";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-001");
    expect(finding).toBeUndefined();
  });
});

describe("scanContent — FINTRAC: cryptocurrency detection", () => {
  it("flags bitcoin reference as AUTO_BLOCK", () => {
    const content = "Payment received via bitcoin wallet address";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-005");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("FINTRAC");
    expect(finding!.disposition).toBe("AUTO_BLOCK");
  });

  it("flags ethereum reference", () => {
    const content = "Transfer via ethereum smart contract detected";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-005");
    expect(finding).toBeDefined();
  });
});

// ── Disposition classification ─────────────────────────────────────────────────

describe("scanContent — disposition classification", () => {
  it("returns AUTO_BLOCK when a Critical finding is present", () => {
    // Email in LOG triggers PIPEDA-001 which is Critical + AUTO_BLOCK
    const log = "User login: test@example.com succeeded";
    const result = scanContent(log, "LOG");
    expect(result.disposition).toBe("AUTO_BLOCK");
  });

  it("returns HUMAN_REQUIRED when only High/HUMAN_REQUIRED findings are present", () => {
    // Phone number in LOG triggers PIPEDA-003 (High, HUMAN_REQUIRED)
    // Ensure no AUTO_BLOCK triggers fire by avoiding email/SIN/credential patterns
    const log = "Support call received from 416-555-1234 regarding their account";
    const result = scanContent(log, "LOG");
    expect(result.disposition).toBe("HUMAN_REQUIRED");
  });

  it("returns ADVISORY when only low-severity advisory findings are present", () => {
    // PIPEDA-007: retention keyword in FREETEXT (Low, ADVISORY)
    const content = "Data retention policy must define TTL for user records.";
    const result = scanContent(content, "FREETEXT");
    expect(result.disposition).toBe("ADVISORY");
  });

  it("returns ADVISORY when no findings are present", () => {
    const content = "The quick brown fox jumps over the lazy dog.";
    const result = scanContent(content, "FREETEXT");
    expect(result.findings).toHaveLength(0);
    expect(result.disposition).toBe("ADVISORY");
  });

  it("AUTO_BLOCK takes precedence over HUMAN_REQUIRED findings", () => {
    // Content triggering both AUTO_BLOCK (SIN) and HUMAN_REQUIRED (phone) patterns
    const content = "SIN 123-456-789 called from 416-555-9876 for account inquiry";
    const result = scanContent(content, "FREETEXT");
    expect(result.disposition).toBe("AUTO_BLOCK");
  });

  it("does not escalate when KYC is explicitly completed", () => {
    const content = "KYC check completed for customer before transfer approval";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-002");
    expect(finding).toBeUndefined();
  });

  it("does not flag structuring without suspicious context", () => {
    const content = "balance is 8000 users and ticket 9000 opened";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-003");
    expect(finding).toBeUndefined();
  });
});

// ── Findings structure ─────────────────────────────────────────────────────────

describe("scanContent — findings structure", () => {
  it("each finding has required fields", () => {
    const log = "Error: user@test.com failed authentication";
    const result = scanContent(log, "LOG");
    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.id).toBeTruthy();
      expect(finding.regulation).toMatch(/^(PIPEDA|FINTRAC)$/);
      expect(finding.severity).toMatch(/^(Low|Medium|High|Critical)$/);
      expect(finding.disposition).toMatch(/^(AUTO_BLOCK|HUMAN_REQUIRED|ADVISORY)$/);
      expect(finding.ruleId).toBeTruthy();
      expect(finding.description).toBeTruthy();
    }
  });

  it("does not fire the same rule twice for a single scan", () => {
    // Content with multiple email addresses — rule should fire once
    const log = "user1@example.com and user2@example.com logged in";
    const result = scanContent(log, "LOG");
    const emailFindings = result.findings.filter((f) => f.ruleId === "PIPEDA-001");
    expect(emailFindings).toHaveLength(1);
  });

  it("returns empty findings array for clean content", () => {
    const content = "Normal log entry: server started successfully on port 3000.";
    const result = scanContent(content, "LOG");
    expect(result.findings).toHaveLength(0);
  });
});
