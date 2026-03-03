namespace TicketDeflection.Services;

public interface IDrillReportService
{
    Task<IReadOnlyList<DrillReport>> GetReportsAsync();
}

public sealed record DrillReport(
    string DrillId,
    string DrillType,
    string? FailureSignature,
    string Verdict,
    string? VerdictReason,
    string? StartedAt,
    string? CompletedAt,
    Dictionary<string, DrillStage> Stages);

public sealed record DrillStage(
    string Status,
    string? Timestamp,
    int? ElapsedFromPreviousS,
    int SlaS,
    string? Url);
