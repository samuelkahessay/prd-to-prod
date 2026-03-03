#nullable enable

using TicketDeflection.Models;

namespace TicketDeflection.Data;

public static class ComplianceSeedData
{
    public static void Seed(TicketDbContext context)
    {
        if (context.ComplianceScans.Any())
            return;

        var now = DateTimeOffset.UtcNow;

        // 1. AUTO_BLOCK scan — SIN in plaintext
        var autoBlockScanId = Guid.NewGuid();
        var autoBlockScan = new ComplianceScan
        {
            Id = autoBlockScanId,
            SubmittedAt = now.AddHours(-3),
            ContentType = ContentType.LOG,
            SourceLabel = "app-server.log",
            Disposition = ComplianceDisposition.AUTO_BLOCK,
            IsDemo = true
        };
        autoBlockScan.Findings.Add(new ComplianceFinding
        {
            Id = Guid.NewGuid(),
            ScanId = autoBlockScanId,
            Regulation = ComplianceRegulation.PIPEDA,
            RuleId = "PIPEDA-001",
            RuleName = "SIN in Plaintext",
            Citation = "PIPEDA s.5(3)",
            Category = "Personal Identifiers",
            Severity = FindingSeverity.Critical,
            Disposition = ComplianceDisposition.AUTO_BLOCK,
            RedactedExcerpt = "SIN: ***-***-***",
            LineNumber = 42,
            StopReason = null,
            Scan = autoBlockScan
        });

        // 2. Pending HUMAN_REQUIRED scan — large transaction without reporting marker
        var humanPendingScanId = Guid.NewGuid();
        var humanPendingScan = new ComplianceScan
        {
            Id = humanPendingScanId,
            SubmittedAt = now.AddHours(-2),
            ContentType = ContentType.CODE,
            SourceLabel = "payment-processor.cs",
            Disposition = ComplianceDisposition.HUMAN_REQUIRED,
            IsDemo = true
        };
        humanPendingScan.Findings.Add(new ComplianceFinding
        {
            Id = Guid.NewGuid(),
            ScanId = humanPendingScanId,
            Regulation = ComplianceRegulation.FINTRAC,
            RuleId = "FINTRAC-001",
            RuleName = "Large Transaction Without Reporting Marker",
            Citation = "FINTRAC PCMLTFA s.9",
            Category = "Transaction Reporting",
            Severity = FindingSeverity.High,
            Disposition = ComplianceDisposition.HUMAN_REQUIRED,
            RedactedExcerpt = "amount > 10000 // [REDACTED]",
            LineNumber = 87,
            StopReason = "Transaction exceeds $10,000 threshold but no CTR/STR reporting marker detected. Legal review required before deployment.",
            Scan = humanPendingScan
        });

        // 3. Decided HUMAN_REQUIRED scan — wire transfer without verification
        var humanDecidedScanId = Guid.NewGuid();
        var humanDecidedScan = new ComplianceScan
        {
            Id = humanDecidedScanId,
            SubmittedAt = now.AddHours(-5),
            ContentType = ContentType.DIFF,
            SourceLabel = "wire-transfer-service.diff",
            Disposition = ComplianceDisposition.HUMAN_REQUIRED,
            IsDemo = true
        };
        humanDecidedScan.Findings.Add(new ComplianceFinding
        {
            Id = Guid.NewGuid(),
            ScanId = humanDecidedScanId,
            Regulation = ComplianceRegulation.FINTRAC,
            RuleId = "FINTRAC-003",
            RuleName = "Wire Transfer Without Identity Verification",
            Citation = "FINTRAC PCMLTFA s.9.1",
            Category = "Identity Verification",
            Severity = FindingSeverity.High,
            Disposition = ComplianceDisposition.HUMAN_REQUIRED,
            RedactedExcerpt = "initiateWireTransfer([REDACTED])",
            LineNumber = 23,
            StopReason = "Wire transfer initiated without confirmed identity verification step. Operator must confirm verification is handled upstream.",
            Scan = humanDecidedScan
        });
        var humanDecidedDecision = new ComplianceDecision
        {
            Id = Guid.NewGuid(),
            ScanId = humanDecidedScanId,
            OperatorId = "demo-operator",
            Decision = ComplianceDecisionType.Approved,
            Notes = "Verification confirmed in upstream auth service. Safe to proceed.",
            DecidedAt = now.AddHours(-4),
            Scan = humanDecidedScan
        };

        // 4. ADVISORY scan with findings — email in log
        var advisoryWithFindingsScanId = Guid.NewGuid();
        var advisoryWithFindingsScan = new ComplianceScan
        {
            Id = advisoryWithFindingsScanId,
            SubmittedAt = now.AddHours(-1),
            ContentType = ContentType.LOG,
            SourceLabel = "debug.log",
            Disposition = ComplianceDisposition.ADVISORY,
            IsDemo = true
        };
        advisoryWithFindingsScan.Findings.Add(new ComplianceFinding
        {
            Id = Guid.NewGuid(),
            ScanId = advisoryWithFindingsScanId,
            Regulation = ComplianceRegulation.PIPEDA,
            RuleId = "PIPEDA-005",
            RuleName = "Email in Plaintext Log",
            Citation = "PIPEDA s.7(1)",
            Category = "Personal Identifiers",
            Severity = FindingSeverity.Medium,
            Disposition = ComplianceDisposition.ADVISORY,
            RedactedExcerpt = "user=***@***.com",
            LineNumber = 14,
            StopReason = null,
            Scan = advisoryWithFindingsScan
        });

        // 5. Clean ADVISORY scan — zero findings
        var cleanScan = new ComplianceScan
        {
            Id = Guid.NewGuid(),
            SubmittedAt = now.AddMinutes(-30),
            ContentType = ContentType.CODE,
            SourceLabel = "utils.cs",
            Disposition = ComplianceDisposition.ADVISORY,
            IsDemo = true
        };

        context.ComplianceScans.AddRange(autoBlockScan, humanPendingScan, humanDecidedScan, advisoryWithFindingsScan, cleanScan);
        context.ComplianceDecisions.Add(humanDecidedDecision);
        context.SaveChanges();
    }
}
