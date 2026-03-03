#nullable enable

using System.Text.RegularExpressions;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Services;

public class ComplianceScanService : IComplianceScanService
{
    private readonly IComplianceRuleLibrary _ruleLibrary;

    public ComplianceScanService(IComplianceRuleLibrary ruleLibrary)
    {
        _ruleLibrary = ruleLibrary;
    }

    public async Task<ComplianceScan> ScanAsync(string content, ContentType contentType, string? sourceLabel, TicketDbContext db)
    {
        bool isTestContext = content.Contains("// test-context", StringComparison.OrdinalIgnoreCase)
                           || content.Contains("// demo-context", StringComparison.OrdinalIgnoreCase);

        var lines = content.Split('\n');
        var rules = _ruleLibrary.GetRules();
        var findings = new List<ComplianceFinding>();

        foreach (var rule in rules)
        {
            var matches = rule.Pattern.Matches(content);
            foreach (Match match in matches)
            {
                // Determine actual disposition (cap at ADVISORY for test/demo contexts)
                var disposition = rule.Disposition;
                if (isTestContext && disposition == ComplianceDisposition.AUTO_BLOCK)
                    disposition = ComplianceDisposition.ADVISORY;

                // Compute 1-based line number
                int lineNumber = 1;
                int charCount = 0;
                for (int i = 0; i < lines.Length; i++)
                {
                    charCount += lines[i].Length + 1; // +1 for '\n'
                    if (charCount > match.Index)
                    {
                        lineNumber = i + 1;
                        break;
                    }
                }

                // Build redacted excerpt
                string rawExcerpt = match.Value;
                string redactedExcerpt = rule.Pattern.Replace(rawExcerpt, "[REDACTED]");

                findings.Add(new ComplianceFinding
                {
                    ScanId = Guid.Empty, // will be set below
                    Regulation = rule.Regulation,
                    RuleId = rule.RuleId,
                    RuleName = rule.RuleName,
                    Citation = rule.Citation,
                    Category = rule.Category,
                    Severity = rule.Severity,
                    Disposition = disposition,
                    RedactedExcerpt = redactedExcerpt,
                    LineNumber = lineNumber,
                    // StopReason only for HUMAN_REQUIRED
                    StopReason = disposition == ComplianceDisposition.HUMAN_REQUIRED ? rule.StopReason : null,
                });

                // Only take first match per rule to avoid flooding
                break;
            }
        }

        // Aggregate disposition
        ComplianceDisposition scanDisposition;
        if (findings.Any(f => f.Disposition == ComplianceDisposition.AUTO_BLOCK))
            scanDisposition = ComplianceDisposition.AUTO_BLOCK;
        else if (findings.Any(f => f.Disposition == ComplianceDisposition.HUMAN_REQUIRED))
            scanDisposition = ComplianceDisposition.HUMAN_REQUIRED;
        else
            scanDisposition = ComplianceDisposition.ADVISORY;

        var scan = new ComplianceScan
        {
            ContentType = contentType,
            SourceLabel = sourceLabel,
            Disposition = scanDisposition,
            IsDemo = isTestContext,
        };

        // Fix up ScanId references
        foreach (var finding in findings)
            finding.ScanId = scan.Id;

        scan.Findings = findings;

        db.ComplianceScans.Add(scan);
        await db.SaveChangesAsync();

        return scan;
    }
}
