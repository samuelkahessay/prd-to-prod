namespace TicketDeflection.Services;

/// <summary>
/// Reads decision ledger events from the drills/decisions/ directory
/// and provides query methods for the autonomy API endpoints.
/// </summary>
public interface IDecisionLedgerService
{
    /// <summary>Returns all ledger events sorted newest-first.</summary>
    Task<IReadOnlyList<DecisionEvent>> GetDecisionsAsync();

    /// <summary>Returns events grouped into blocked, queued-for-human, and recent autonomous buckets.</summary>
    Task<DecisionQueue> GetQueueAsync();

    /// <summary>Returns aggregate counts across all ledger events.</summary>
    Task<DecisionMetrics> GetMetricsAsync();
}

/// <summary>
/// A single decision ledger event, matching the JSON schema in docs/decision-ledger/README.md.
/// </summary>
public sealed record DecisionEvent(
    int SchemaVersion,
    string EventId,
    string Timestamp,
    DecisionActor Actor,
    string Workflow,
    string RequestedAction,
    PolicyResult PolicyResult,
    DecisionTarget Target,
    string[] Evidence,
    string Outcome,
    string Summary,
    string? HumanOwner,
    string? Replaces = null);

public sealed record DecisionActor(string Type, string Name);

public sealed record PolicyResult(string Mode, string? Reason);

public sealed record DecisionTarget(string Type, string? Id, string? Path, string? Display);

public sealed record DecisionQueue(
    IReadOnlyList<DecisionEvent> Blocked,
    IReadOnlyList<DecisionEvent> QueuedForHuman,
    IReadOnlyList<DecisionEvent> RecentAutonomous);

public sealed record DecisionMetrics(
    int TotalEvents,
    int AutonomousActed,
    int Blocked,
    int QueuedForHuman,
    int Escalated,
    string? LastUpdatedUtc);
