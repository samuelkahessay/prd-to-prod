using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace TicketDeflection.Services;

public sealed class DecisionLedgerService : IDecisionLedgerService
{
    private readonly string _decisionsPath;
    private readonly ILogger<DecisionLedgerService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public DecisionLedgerService(
        IConfiguration configuration,
        IWebHostEnvironment env,
        ILogger<DecisionLedgerService> logger)
    {
        _logger = logger;
        var configured = configuration["DecisionLedger:Path"];
        _decisionsPath = !string.IsNullOrEmpty(configured)
            ? configured
            : ResolveDefaultDecisionsPath(env.ContentRootPath);
    }

    /// <summary>
    /// Resolves the decisions directory relative to the content root.
    /// In local dev, ContentRootPath is TicketDeflection/, so drills/decisions/
    /// is at ../drills/decisions/. In published output, it would be at
    /// drills/decisions/ directly under the content root.
    /// </summary>
    internal static string ResolveDefaultDecisionsPath(string contentRoot)
    {
        var publishedPath = Path.GetFullPath(Path.Combine(contentRoot, "drills", "decisions"));
        if (Directory.Exists(publishedPath))
            return publishedPath;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "drills", "decisions"));
    }

    public Task<IReadOnlyList<DecisionEvent>> GetDecisionsAsync()
    {
        var events = LoadAllEvents();
        events.Sort((a, b) => CompareTimestampsDescending(a.Timestamp, b.Timestamp));
        return Task.FromResult<IReadOnlyList<DecisionEvent>>(events);
    }

    public async Task<DecisionQueue> GetQueueAsync()
    {
        var all = await GetDecisionsAsync();

        var blocked = all.Where(e => e.Outcome == "blocked").ToList();
        var queuedForHuman = all.Where(e => e.Outcome == "queued_for_human").ToList();
        var recentAutonomous = all
            .Where(e => e.Outcome == "acted" && e.PolicyResult.Mode == "autonomous")
            .ToList();

        return new DecisionQueue(blocked, queuedForHuman, recentAutonomous);
    }

    public async Task<DecisionMetrics> GetMetricsAsync()
    {
        var all = await GetDecisionsAsync();

        var total = all.Count;
        var autonomousActed = all.Count(e => e.Outcome == "acted" && e.PolicyResult.Mode == "autonomous");
        var blocked = all.Count(e => e.Outcome == "blocked");
        var queuedForHuman = all.Count(e => e.Outcome == "queued_for_human");
        var escalated = all.Count(e => e.Outcome == "escalated");

        string? lastUpdatedUtc = all.Count > 0 ? all[0].Timestamp : null;

        return new DecisionMetrics(total, autonomousActed, blocked, queuedForHuman, escalated, lastUpdatedUtc);
    }

    private List<DecisionEvent> LoadAllEvents()
    {
        var results = new List<DecisionEvent>();

        if (!Directory.Exists(_decisionsPath))
        {
            _logger.LogWarning("Decision ledger directory not found at {Path}", _decisionsPath);
            return results;
        }

        foreach (var file in Directory.EnumerateFiles(_decisionsPath, "*.json"))
        {
            try
            {
                var json = File.ReadAllText(file);
                var evt = JsonSerializer.Deserialize<DecisionEvent>(json, JsonOpts);
                if (evt is not null)
                    results.Add(evt);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Skipping decision file {File}: failed to parse", file);
            }
        }

        // Remove events that have been superseded by corrected versions
        var replacedIds = new HashSet<string>(
            results.Where(e => e.Replaces is not null).Select(e => e.Replaces!),
            StringComparer.Ordinal);
        if (replacedIds.Count > 0)
            results.RemoveAll(e => replacedIds.Contains(e.EventId));

        return results;
    }

    private static int CompareTimestampsDescending(string left, string right)
    {
        var leftParsed = ParseTimestamp(left);
        var rightParsed = ParseTimestamp(right);
        return rightParsed.CompareTo(leftParsed);
    }

    private static DateTimeOffset ParseTimestamp(string value)
    {
        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : DateTimeOffset.MinValue;
    }
}
