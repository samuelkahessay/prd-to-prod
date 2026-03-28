import { scanContent } from "@/components/showcase/compliance/scanner";

// ── PIPEDA-001: SIN detection ────────────────────────────────────────────────

describe("scanContent — PIPEDA-001: SIN in plaintext", () => {
  it("detects a SIN with dashes", () => {
    const content = "Customer SIN on file: 123-456-789";
    const result = scanContent(content, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-001");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("PIPEDA");
    expect(finding!.severity).toBe("Critical");
    expect(finding!.disposition).toBe("AUTO_BLOCK");
    expect(finding!.citation).toBe("PIPEDA s.5(3)");
  });

  it("detects a SIN with spaces", () => {
    const content = "SIN: 987 654 321 stored in user record";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-001");
    expect(finding).toBeDefined();
  });

  it("detects a SIN without separators", () => {
    const content = "SIN: 123456789 in database";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-001");
    expect(finding).toBeDefined();
  });

  it("includes line number for SIN match", () => {
    const content = "Line one.\nLine two with SIN 987 654 321 here.\nLine three.";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-001");
    expect(finding).toBeDefined();
    expect(finding!.lineNumber).toBe(2);
  });
});

// ── PIPEDA-002: Account number exposure ──────────────────────────────────────

describe("scanContent — PIPEDA-002: account number exposure", () => {
  it("detects account_number with digits", () => {
    const content = "Customer account_number: 7891234 logged for debugging";
    const result = scanContent(content, "CODE");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-002");
    expect(finding).toBeDefined();
    expect(finding!.disposition).toBe("HUMAN_REQUIRED");
    expect(finding!.citation).toBe("PIPEDA s.4.7");
  });

  it("detects acct# pattern", () => {
    const content = "acct# 12345678 overdue";
    const result = scanContent(content, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-002");
    expect(finding).toBeDefined();
  });
});

// ── PIPEDA-003: DOB in logs ──────────────────────────────────────────────────

describe("scanContent — PIPEDA-003: date of birth detection", () => {
  it("detects dob keyword in LOG content", () => {
    const log = "User profile: dob=1990-05-15, name=John";
    const result = scanContent(log, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-003");
    expect(finding).toBeDefined();
    expect(finding!.disposition).toBe("HUMAN_REQUIRED");
    expect(finding!.citation).toBe("PIPEDA s.4.3");
  });

  it("detects date_of_birth in CODE", () => {
    const code = "const dateOfBirth = user.profile.date_of_birth;";
    const result = scanContent(code, "CODE");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-003");
    expect(finding).toBeDefined();
  });

  it("does NOT fire for FREETEXT content type", () => {
    const text = "We need to collect date of birth for verification.";
    const result = scanContent(text, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-003");
    expect(finding).toBeUndefined();
  });
});

// ── PIPEDA-005: Email in plaintext (ADVISORY) ───────────────────────────────

describe("scanContent — PIPEDA-005: email in plaintext", () => {
  it("detects an email address and reports as ADVISORY", () => {
    const content = "Contact: jane.doe@example.com for support.";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-005");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("Medium");
    expect(finding!.disposition).toBe("ADVISORY");
    expect(finding!.citation).toBe("PIPEDA Principle 4.3");
  });
});

// ── PIPEDA-007: Credit card unmasked ─────────────────────────────────────────

describe("scanContent — PIPEDA-007: credit card detection", () => {
  it("detects a Visa card number", () => {
    const content = "Card: 4532-1234-5678-9012 was charged";
    const result = scanContent(content, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-007");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("Critical");
    expect(finding!.disposition).toBe("AUTO_BLOCK");
    expect(finding!.citation).toBe("PIPEDA s.4.7");
  });

  it("detects a Mastercard number without dashes", () => {
    const content = "Payment with 5234567890123456 processed";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-007");
    expect(finding).toBeDefined();
  });
});

// ── PIPEDA-008: Health information ───────────────────────────────────────────

describe("scanContent — PIPEDA-008: health information", () => {
  it("detects health_record reference", () => {
    const code = "if (user.healthRecord) { return sensitive; }";
    const result = scanContent(code, "CODE");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-008");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("Critical");
    expect(finding!.disposition).toBe("AUTO_BLOCK");
    expect(finding!.citation).toBe("PIPEDA s.4.3.4");
  });

  it("detects diagnosis keyword", () => {
    const content = "Patient diagnosis: Type 2 Diabetes";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "PIPEDA-008");
    expect(finding).toBeDefined();
  });
});

// ── FINTRAC-001: Large transaction ──────────────────────────────────────────

describe("scanContent — FINTRAC-001: large transaction detection", () => {
  it("detects a transaction exceeding $10,000", () => {
    const log = "Transaction processed: $12,500 deposit from account 88271";
    const result = scanContent(log, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-001");
    expect(finding).toBeDefined();
    expect(finding!.regulation).toBe("FINTRAC");
    expect(finding!.disposition).toBe("HUMAN_REQUIRED");
    expect(finding!.citation).toBe("Proceeds of Crime Act s.9");
  });

  it("detects a large amount with CAD currency marker", () => {
    const content = "Transfer of 15000 CAD initiated by customer";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-001");
    expect(finding).toBeDefined();
  });

  it("does not treat arbitrary 5-digit numbers as reportable transactions", () => {
    const content = "build id 12345 completed successfully";
    const result = scanContent(content, "FREETEXT");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-001");
    expect(finding).toBeUndefined();
  });
});

// ── FINTRAC-002: SAR bypass ──────────────────────────────────────────────────

describe("scanContent — FINTRAC-002: SAR bypass detection", () => {
  it("detects skip_sar pattern", () => {
    const content = "Config: skip_sar=true for test accounts";
    const result = scanContent(content, "CODE");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-002");
    expect(finding).toBeDefined();
    expect(finding!.disposition).toBe("AUTO_BLOCK");
    expect(finding!.citation).toBe("PCMLTFA s.7");
  });

  it("detects bypass_report pattern", () => {
    const content = "// bypass_report for staging environment";
    const result = scanContent(content, "DIFF");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-002");
    expect(finding).toBeDefined();
  });
});

// ── FINTRAC-005: Cash without CTR ────────────────────────────────────────────

describe("scanContent — FINTRAC-005: cash without CTR", () => {
  it("detects cash transaction without CTR reference", () => {
    const content = "Cash deposit $11,200 CAD for beneficiary account transfer";
    const result = scanContent(content, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-005");
    expect(finding).toBeDefined();
    expect(finding!.disposition).toBe("HUMAN_REQUIRED");
    expect(finding!.citation).toBe("PCMLTFA s.9(1)");
  });

  it("does not fire when CTR is referenced", () => {
    const content = "Cash deposit $11,200 CAD — CTR filed at 14:30";
    const result = scanContent(content, "LOG");
    const finding = result.findings.find((f) => f.ruleId === "FINTRAC-005");
    expect(finding).toBeUndefined();
  });
});

// ── Disposition classification ───────────────────────────────────────────────

describe("scanContent — disposition classification", () => {
  it("returns AUTO_BLOCK when a Critical finding is present (SIN)", () => {
    const content = "Customer SIN: 123-456-789 on record";
    const result = scanContent(content, "LOG");
    expect(result.disposition).toBe("AUTO_BLOCK");
  });

  it("returns HUMAN_REQUIRED when only HUMAN_REQUIRED findings are present", () => {
    const content = "User profile: dob=1990-05-15 loaded for verification";
    const result = scanContent(content, "LOG");
    expect(result.disposition).toBe("HUMAN_REQUIRED");
  });

  it("returns ADVISORY when only advisory findings are present (email)", () => {
    const content = "Please contact admin@example.com for more info.";
    const result = scanContent(content, "FREETEXT");
    expect(result.disposition).toBe("ADVISORY");
  });

  it("returns ADVISORY when no findings are present", () => {
    const content = "The quick brown fox jumps over the lazy dog.";
    const result = scanContent(content, "FREETEXT");
    expect(result.findings).toHaveLength(0);
    expect(result.disposition).toBe("ADVISORY");
  });

  it("AUTO_BLOCK takes precedence over HUMAN_REQUIRED", () => {
    const content = "SIN 123-456-789 with dob=1990-01-01 in record";
    const result = scanContent(content, "LOG");
    expect(result.disposition).toBe("AUTO_BLOCK");
  });
});

// ── Citations ────────────────────────────────────────────────────────────────

describe("scanContent — citation field", () => {
  it("every finding includes a citation", () => {
    const content = "SIN 123-456-789 and health_record detected with dob=1990-01-01";
    const result = scanContent(content, "LOG");
    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.citation).toBeTruthy();
    }
  });
});

// ── Findings structure ──────────────────────────────────────────────────────

describe("scanContent — findings structure", () => {
  it("each finding has required fields", () => {
    const content = "SIN 123-456-789 in log with contact@acme.co";
    const result = scanContent(content, "LOG");
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
    const content = "SIN 123-456-789 and SIN 987-654-321 both exposed";
    const result = scanContent(content, "LOG");
    const sinFindings = result.findings.filter((f) => f.ruleId === "PIPEDA-001");
    expect(sinFindings).toHaveLength(1);
  });

  it("returns empty findings array for clean content", () => {
    const content = "Normal log entry: server started successfully on port 3000.";
    const result = scanContent(content, "LOG");
    expect(result.findings).toHaveLength(0);
  });
});
