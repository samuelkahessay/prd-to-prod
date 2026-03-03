using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace TicketDeflection.Services;

public sealed class DrillReportService : IDrillReportService
{
    private readonly string _reportsPath;
    private readonly ILogger<DrillReportService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public DrillReportService(
        IConfiguration configuration,
        IWebHostEnvironment env,
        ILogger<DrillReportService> logger)
    {
        _logger = logger;
        var configured = configuration["DrillReports:Path"];
        _reportsPath = !string.IsNullOrEmpty(configured)
            ? configured
            : ResolveDefaultReportsPath(env.ContentRootPath);
    }

    /// <summary>
    /// Resolves the reports directory relative to the content root.
    /// In local dev, ContentRootPath is TicketDeflection/, so drills/reports/
    /// is at ../drills/reports/. In published output, it would be at
    /// drills/reports/ directly under the content root.
    /// </summary>
    internal static string ResolveDefaultReportsPath(string contentRoot)
    {
        var publishedPath = Path.GetFullPath(Path.Combine(contentRoot, "drills", "reports"));
        if (Directory.Exists(publishedPath))
            return publishedPath;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "drills", "reports"));
    }

    public Task<IReadOnlyList<DrillReport>> GetReportsAsync()
    {
        var reports = LoadAllReports();
        reports.Sort((a, b) => CompareTimestampsDescending(a.StartedAt, b.StartedAt));
        return Task.FromResult<IReadOnlyList<DrillReport>>(reports);
    }

    private List<DrillReport> LoadAllReports()
    {
        var results = new List<DrillReport>();

        if (!Directory.Exists(_reportsPath))
        {
            _logger.LogWarning("Drill reports directory not found at {Path}", _reportsPath);
            return results;
        }

        foreach (var file in Directory.EnumerateFiles(_reportsPath, "*.json"))
        {
            try
            {
                var json = File.ReadAllText(file);
                var report = JsonSerializer.Deserialize<DrillReport>(json, JsonOpts);
                if (report is not null)
                    results.Add(report);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Skipping drill report file {File}: failed to parse", file);
            }
        }

        return results;
    }

    private static int CompareTimestampsDescending(string? left, string? right)
    {
        var leftParsed = ParseTimestamp(left);
        var rightParsed = ParseTimestamp(right);
        return rightParsed.CompareTo(leftParsed);
    }

    private static DateTimeOffset ParseTimestamp(string? value)
    {
        if (value is null)
            return DateTimeOffset.MinValue;
        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : DateTimeOffset.MinValue;
    }
}
