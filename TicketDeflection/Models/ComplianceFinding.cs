#nullable enable

using System.Text.Json.Serialization;

namespace TicketDeflection.Models;

public class ComplianceFinding
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ScanId { get; set; }
    public ComplianceRegulation Regulation { get; set; }
    public string RuleId { get; set; } = string.Empty;
    public string RuleName { get; set; } = string.Empty;
    public string Citation { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public FindingSeverity Severity { get; set; }
    public ComplianceDisposition Disposition { get; set; }
    public string? RedactedExcerpt { get; set; }
    public int? LineNumber { get; set; }
    /// <summary>Populated only for HUMAN_REQUIRED findings; null for AUTO_BLOCK and ADVISORY.</summary>
    public string? StopReason { get; set; }
    [JsonIgnore]
    public ComplianceScan? Scan { get; set; }
}

