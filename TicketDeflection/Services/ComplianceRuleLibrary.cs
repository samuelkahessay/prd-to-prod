#nullable enable

using System.Text.RegularExpressions;
using TicketDeflection.Models;

namespace TicketDeflection.Services;

public record ComplianceRuleDefinition(
    string RuleId,
    string RuleName,
    ComplianceRegulation Regulation,
    string Citation,
    string Category,
    FindingSeverity Severity,
    ComplianceDisposition Disposition,
    Regex Pattern,
    string? StopReason = null
);

public interface IComplianceRuleLibrary
{
    IReadOnlyList<ComplianceRuleDefinition> GetRules();
}

public sealed class ComplianceRuleLibrary : IComplianceRuleLibrary
{
    private static readonly IReadOnlyList<ComplianceRuleDefinition> _rules = BuildRules();

    public IReadOnlyList<ComplianceRuleDefinition> GetRules() => _rules;

    private static List<ComplianceRuleDefinition> BuildRules() =>
    [
        // ── PIPEDA Rules ──────────────────────────────────────────────────────

        new(
            "PIPEDA-001",
            "SIN in Plaintext",
            ComplianceRegulation.PIPEDA,
            "PIPEDA s.5(3)",
            "Personal Identifiers",
            FindingSeverity.Critical,
            ComplianceDisposition.AUTO_BLOCK,
            new Regex(@"\bSIN\s*[:\-=]?\s*\d{3}[-\s]?\d{3}[-\s]?\d{3}\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        ),

        new(
            "PIPEDA-002",
            "Account Number Exposure",
            ComplianceRegulation.PIPEDA,
            "PIPEDA s.5(3)",
            "Financial Identifiers",
            FindingSeverity.High,
            ComplianceDisposition.HUMAN_REQUIRED,
            new Regex(@"\b(?:return|Results\.(?:Ok|Json)|WriteAsJsonAsync|logger\.Log(?:Trace|Debug|Information|Warning|Error|Critical)?|_logger\.Log(?:Trace|Debug|Information|Warning|Error|Critical)?|Console\.WriteLine)\b[\s\S]{0,200}\b(?:\w+\.)*(?:account(?:_?(?:number|num|no))|acct(?:_?(?:number|num|no))?)\b(?![\s\S]{0,80}\b(?:mask(?:ed|ing)?|encrypt(?:ed|ion)?|redact(?:ed|ion)?|hash(?:ed|ing)?)\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            "Account number field detected in code without masking or encryption markers. Operator must verify this is not exposed to end users or logs."
        ),

        new(
            "PIPEDA-003",
            "Date of Birth Exposed in Log",
            ComplianceRegulation.PIPEDA,
            "PIPEDA s.7(1)",
            "Personal Identifiers",
            FindingSeverity.High,
            ComplianceDisposition.HUMAN_REQUIRED,
            new Regex(@"\b(?:dob|date[_\-\s]of[_\-\s]birth|birthdate)\s*[:\-=]\s*\d{4}[-/]\d{2}[-/]\d{2}", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            "Date of birth detected in output. Confirm whether this is intentional logging or an accidental data exposure before deployment."
        ),

        new(
            "PIPEDA-004",
            "Personal Identifier in URL",
            ComplianceRegulation.PIPEDA,
            "PIPEDA Schedule 1, Principle 4.7",
            "URL Exposure",
            FindingSeverity.Medium,
            ComplianceDisposition.HUMAN_REQUIRED,
            new Regex(@"https?://[^\s]*(?:sin|ssn|passport|dob|account)[=\/][0-9a-zA-Z\-]{4,}", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            "Sensitive personal identifier appears in URL parameter. URL logging may expose this data. Operator review required."
        ),

        new(
            "PIPEDA-005",
            "Email in Plaintext Log",
            ComplianceRegulation.PIPEDA,
            "PIPEDA s.7(1)",
            "Personal Identifiers",
            FindingSeverity.Medium,
            ComplianceDisposition.ADVISORY,
            new Regex(@"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        ),

        new(
            "PIPEDA-006",
            "Phone Number in Log",
            ComplianceRegulation.PIPEDA,
            "PIPEDA s.5(3)",
            "Personal Identifiers",
            FindingSeverity.Medium,
            ComplianceDisposition.ADVISORY,
            new Regex(@"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", RegexOptions.Compiled)
        ),

        new(
            "PIPEDA-007",
            "Unmasked Credit Card Number",
            ComplianceRegulation.PIPEDA,
            "PIPEDA s.5(3)",
            "Financial Identifiers",
            FindingSeverity.Critical,
            ComplianceDisposition.AUTO_BLOCK,
            new Regex(@"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b", RegexOptions.Compiled)
        ),

        new(
            "PIPEDA-008",
            "Health Information in Plaintext",
            ComplianceRegulation.PIPEDA,
            "PIPEDA s.5(3)",
            "Health Information",
            FindingSeverity.Critical,
            ComplianceDisposition.AUTO_BLOCK,
            new Regex(@"\b(?:diagnosis|prescription|medical[_\s]record|patient[_\s]id|health[_\s]card)\s*[:\-=]\s*\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        ),

        // ── FINTRAC Rules ─────────────────────────────────────────────────────

        new(
            "FINTRAC-001",
            "Large Transaction Without Reporting Marker",
            ComplianceRegulation.FINTRAC,
            "FINTRAC PCMLTFA s.9",
            "Transaction Reporting",
            FindingSeverity.High,
            ComplianceDisposition.HUMAN_REQUIRED,
            new Regex(@"\bamount\s*[>≥]\s*10[,\s]?000\b(?!.*\b(?:CTR|STR|reported)\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            "Transaction exceeds $10,000 threshold without a CTR/STR reporting marker. Operator must confirm compliance reporting is handled."
        ),

        new(
            "FINTRAC-002",
            "Suspicious Activity Review Bypass",
            ComplianceRegulation.FINTRAC,
            "FINTRAC PCMLTFA s.7",
            "Suspicious Transaction Reporting",
            FindingSeverity.Critical,
            ComplianceDisposition.AUTO_BLOCK,
            new Regex(@"\bbypass(?:SuspiciousReview|_suspicious_review|AmlCheck)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        ),

        new(
            "FINTRAC-003",
            "Wire Transfer Without Identity Verification",
            ComplianceRegulation.FINTRAC,
            "FINTRAC PCMLTFA s.9(1)",
            "Identity Verification",
            FindingSeverity.High,
            ComplianceDisposition.HUMAN_REQUIRED,
            new Regex(@"\b(?:initiateWireTransfer|wire_transfer|wireTransfer)\b(?!.*\b(?:verified|kyc|identity_check)\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            "Wire transfer operation detected without confirmed identity verification. Operator must confirm KYC/verification is enforced upstream."
        ),

        new(
            "FINTRAC-004",
            "Missing Audit Field on Financial Record",
            ComplianceRegulation.FINTRAC,
            "FINTRAC PCMLTFA s.6",
            "Record Keeping",
            FindingSeverity.Medium,
            ComplianceDisposition.ADVISORY,
            new Regex(@"\bclass\s+\w*(?:Transaction|Payment|Transfer)\w*\b(?![^{]*\bauditedAt\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.Singleline)
        ),

        new(
            "FINTRAC-005",
            "Cash Transaction Without CTR Reference",
            ComplianceRegulation.FINTRAC,
            "FINTRAC PCMLTFA s.9(1)(a)",
            "Transaction Reporting",
            FindingSeverity.High,
            ComplianceDisposition.HUMAN_REQUIRED,
            new Regex(@"\bcash[_\s]transaction\b(?!.*\bCTR\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            "Cash transaction processed without a Currency Transaction Report (CTR) reference. Verify reporting obligations are met."
        ),

        new(
            "FINTRAC-006",
            "AML Check Suppressed",
            ComplianceRegulation.FINTRAC,
            "FINTRAC PCMLTFA s.9.4(1)",
            "AML Controls",
            FindingSeverity.Critical,
            ComplianceDisposition.AUTO_BLOCK,
            new Regex(@"\b(?:skipAml|skip_aml|aml_disabled|disableAml)\s*[=(]?\s*true\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        ),

        new(
            "FINTRAC-007",
            "Large Transaction Threshold Hard-Coded",
            ComplianceRegulation.FINTRAC,
            "FINTRAC PCMLTFA s.9",
            "Transaction Reporting",
            FindingSeverity.Medium,
            ComplianceDisposition.ADVISORY,
            new Regex(@"\b(?:const|val|final|static)\s+\w*[Tt]hreshold\w*\s*=\s*10000\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        )
    ];
}
