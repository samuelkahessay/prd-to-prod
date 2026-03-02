using System.Text.Json;
using Microsoft.Extensions.Logging;
using TicketDeflection.Models;

namespace TicketDeflection.Services;

public sealed class ShowcaseService : IShowcaseService
{
    private readonly string _showcasePath;
    private readonly ILogger<ShowcaseService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ShowcaseService(IConfiguration configuration, IWebHostEnvironment env, ILogger<ShowcaseService> logger)
    {
        _logger = logger;
        var configured = configuration["ShowcasePath"];
        _showcasePath = !string.IsNullOrEmpty(configured)
            ? configured
            : Path.Combine(env.ContentRootPath, "..", "showcase");
    }

    public Task<IReadOnlyList<ShowcaseRun>> GetCompletedRunsAsync()
    {
        var results = new List<ShowcaseRun>();

        if (!Directory.Exists(_showcasePath))
            return Task.FromResult<IReadOnlyList<ShowcaseRun>>(results);

        foreach (var dir in Directory.EnumerateDirectories(_showcasePath))
        {
            var slug = Path.GetFileName(dir);
            var manifestPath = Path.Combine(dir, "manifest.json");
            var runDataPath = Path.Combine(dir, "run-data.json");

            // Both files must exist — partial runs are excluded
            if (!File.Exists(manifestPath) || !File.Exists(runDataPath))
                continue;

            try
            {
                var json = File.ReadAllText(manifestPath);
                var manifest = JsonSerializer.Deserialize<ManifestJson>(json, JsonOpts);
                if (manifest is null) continue;

                results.Add(new ShowcaseRun(
                    Slug: slug,
                    Number: manifest.Run.Number,
                    Name: manifest.Run.Name,
                    Tag: manifest.Run.Tag,
                    TechStack: manifest.Run.TechStack,
                    Date: manifest.Run.Date,
                    Deployment: manifest.Run.Deployment,
                    PrdPath: manifest.Run.Prd,
                    IssueCount: manifest.Issues.Length,
                    PrCount: manifest.PullRequests.Length
                ));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Skipping showcase directory {Slug}: failed to read or parse manifest.json", slug);
            }
        }

        results.Sort((a, b) => a.Number.CompareTo(b.Number));
        return Task.FromResult<IReadOnlyList<ShowcaseRun>>(results);
    }

    public Task<ShowcaseRunDetail?> GetRunDetailAsync(string slug)
    {
        var dir = Path.Combine(_showcasePath, slug);
        var manifestPath = Path.Combine(dir, "manifest.json");
        var runDataPath = Path.Combine(dir, "run-data.json");

        if (!File.Exists(manifestPath) || !File.Exists(runDataPath))
            return Task.FromResult<ShowcaseRunDetail?>(null);

        try
        {
            var runDataJson = File.ReadAllText(runDataPath);
            var runData = JsonSerializer.Deserialize<RunDataJson>(runDataJson, JsonOpts);
            if (runData is null) return Task.FromResult<ShowcaseRunDetail?>(null);

            var manifestJson = File.ReadAllText(manifestPath);
            var manifest = JsonSerializer.Deserialize<ManifestJson>(manifestJson, JsonOpts);
            if (manifest is null) return Task.FromResult<ShowcaseRunDetail?>(null);

            var detail = new ShowcaseRunDetail(
                Slug: slug,
                Number: runData.Run.Number,
                Name: runData.Run.Name,
                Tag: runData.Run.Tag,
                TechStack: runData.Run.TechStack,
                Date: runData.Run.Date,
                Deployment: runData.Run.Deployment,
                PrdPath: runData.Run.Prd,
                IssueCount: manifest.Issues.Length,
                PrCount: manifest.PullRequests.Length,
                Stats: new ShowcaseStats(
                    IssuesCreated: runData.Stats.IssuesCreated,
                    PrsTotal: runData.Stats.PrsTotal,
                    PrsMerged: runData.Stats.PrsMerged,
                    LinesAdded: runData.Stats.LinesAdded,
                    LinesRemoved: runData.Stats.LinesRemoved,
                    FilesChanged: runData.Stats.FilesChanged
                ),
                Timeline: runData.Timeline.Select(t => new ShowcaseTimelineEvent(
                    Timestamp: t.Timestamp,
                    Event: t.Event,
                    Item: t.Item,
                    Title: t.Title
                )).ToList()
            );

            return Task.FromResult<ShowcaseRunDetail?>(detail);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Skipping showcase run {Slug}: failed to read or parse run-data.json", slug);
            return Task.FromResult<ShowcaseRunDetail?>(null);
        }
    }
}
