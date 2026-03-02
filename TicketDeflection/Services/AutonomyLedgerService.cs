using System.Text.Json;
using TicketDeflection.DTOs;

namespace TicketDeflection.Services;

/// <summary>
/// Loads and parses decision-ledger JSON files from the drills/reports directory.
/// Returns an empty list when no ledger files are found.
/// </summary>
public class AutonomyLedgerService
{
    private readonly string _reportsDirectory;

    public AutonomyLedgerService(string? reportsDirectory = null)
    {
        // Default to drills/reports relative to the application's content root.
        _reportsDirectory = reportsDirectory
            ?? Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "drills", "reports");
    }

    /// <summary>Returns all ledger events sorted newest-first.</summary>
    public IReadOnlyList<LedgerEvent> GetAllEvents()
    {
        var events = LoadEvents();
        return events.OrderByDescending(e => e.Timestamp).ToList();
    }

    /// <summary>Returns the operator queue with blocked, human-required, and autonomous buckets.</summary>
    public QueueResponse GetQueue()
    {
        var all = GetAllEvents();
        var blocked = all.Where(e => IsBlocked(e)).ToList();
        var humanQueue = all.Where(e => IsQueuedForHuman(e)).ToList();
        var autonomous = all.Where(e => IsAutonomousActed(e)).ToList();
        return new QueueResponse(blocked, humanQueue, autonomous);
    }

    /// <summary>Returns aggregate metrics from all ledger events.</summary>
    public MetricsResponse GetMetrics()
    {
        var all = LoadEvents();
        var total = all.Count;
        var autonomousActed = all.Count(IsAutonomousActed);
        var blocked = all.Count(IsBlocked);
        var humanQueue = all.Count(IsQueuedForHuman);
        var escalated = all.Count(e =>
            string.Equals(e.Outcome, "escalated", StringComparison.OrdinalIgnoreCase));
        var lastUpdated = all.Count > 0
            ? (DateTime?)all.Max(e => e.Timestamp)
            : null;
        return new MetricsResponse(total, autonomousActed, blocked, humanQueue, escalated, lastUpdated);
    }

    // --- private helpers ---

    private List<LedgerEvent> LoadEvents()
    {
        var events = new List<LedgerEvent>();
        if (!Directory.Exists(_reportsDirectory))
            return events;

        foreach (var file in Directory.EnumerateFiles(_reportsDirectory, "*.json"))
        {
            try
            {
                var text = File.ReadAllText(file);
                var parsed = ParseLedgerFile(text);
                events.AddRange(parsed);
            }
            catch (Exception)
            {
                // Skip malformed files silently — fail-open for reads.
            }
        }

        return events;
    }

    private static IEnumerable<LedgerEvent> ParseLedgerFile(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Support both array-of-events and single-event shapes.
        if (root.ValueKind == JsonValueKind.Array)
        {
            return root.EnumerateArray().Select(ParseSingleEvent).ToList();
        }

        if (root.ValueKind == JsonValueKind.Object)
        {
            // If the object has an "events" array, use that.
            if (root.TryGetProperty("events", out var eventsEl) && eventsEl.ValueKind == JsonValueKind.Array)
                return eventsEl.EnumerateArray().Select(ParseSingleEvent).ToList();

            // Otherwise treat the object itself as a single event.
            return new[] { ParseSingleEvent(root) };
        }

        return Enumerable.Empty<LedgerEvent>();
    }

    private static LedgerEvent ParseSingleEvent(JsonElement el)
    {
        var action = el.TryGetProperty("action", out var a) ? a.GetString() ?? "" : "";
        var classification = el.TryGetProperty("classification", out var c) ? c.GetString() ?? "" : "";
        var outcome = el.TryGetProperty("outcome", out var o) ? o.GetString() : null;
        var reason = el.TryGetProperty("reason", out var r) ? r.GetString() : null;

        DateTime timestamp = DateTime.UtcNow;
        if (el.TryGetProperty("timestamp", out var ts) && ts.ValueKind == JsonValueKind.String)
            DateTime.TryParse(ts.GetString(), out timestamp);

        return new LedgerEvent(action, classification, timestamp, outcome, reason);
    }

    private static bool IsBlocked(LedgerEvent e) =>
        string.Equals(e.Outcome, "blocked", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(e.Classification, "blocked", StringComparison.OrdinalIgnoreCase);

    private static bool IsQueuedForHuman(LedgerEvent e) =>
        string.Equals(e.Classification, "human_required", StringComparison.OrdinalIgnoreCase) &&
        !IsBlocked(e);

    private static bool IsAutonomousActed(LedgerEvent e) =>
        string.Equals(e.Classification, "autonomous", StringComparison.OrdinalIgnoreCase) &&
        !IsBlocked(e) &&
        !string.Equals(e.Outcome, "escalated", StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(e.Outcome, "queued", StringComparison.OrdinalIgnoreCase);
}
