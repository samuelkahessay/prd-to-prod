namespace TicketDeflection.DTOs;

/// <summary>A single event recorded in the decision ledger.</summary>
public record LedgerEvent(
    string Action,
    string Classification,
    DateTime Timestamp,
    string? Outcome,
    string? Reason
);

/// <summary>Response for GET /api/autonomy/decisions — ledger events newest-first.</summary>
public record DecisionsResponse(
    IReadOnlyList<LedgerEvent> Events
);

/// <summary>Response for GET /api/autonomy/queue — operator action buckets.</summary>
public record QueueResponse(
    IReadOnlyList<LedgerEvent> Blocked,
    IReadOnlyList<LedgerEvent> QueuedForHuman,
    IReadOnlyList<LedgerEvent> RecentAutonomous
);

/// <summary>Response for GET /api/autonomy/metrics — aggregated counts.</summary>
public record MetricsResponse(
    int TotalEvents,
    int AutonomousActed,
    int Blocked,
    int QueuedForHuman,
    int Escalated,
    DateTime? LastUpdated
);
