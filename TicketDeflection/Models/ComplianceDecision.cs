#nullable enable

using System.Text.Json.Serialization;

namespace TicketDeflection.Models;

public class ComplianceDecision
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ScanId { get; set; }
    public string OperatorId { get; set; } = string.Empty;
    public ComplianceDecisionType Decision { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset DecidedAt { get; set; } = DateTimeOffset.UtcNow;
    [JsonIgnore]
    public ComplianceScan? Scan { get; set; }
}
