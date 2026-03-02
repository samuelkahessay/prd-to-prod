using System.Text.Json.Serialization;

namespace TicketDeflection.Models;

public record ShowcaseRun(
    string Slug,
    int Number,
    string Name,
    string Tag,
    string TechStack,
    string Date,
    string? Deployment,
    string PrdPath,
    int IssueCount,
    int PrCount
);

public record ShowcaseRunDetail(
    string Slug,
    int Number,
    string Name,
    string Tag,
    string TechStack,
    string Date,
    string? Deployment,
    string PrdPath,
    int IssueCount,
    int PrCount,
    ShowcaseStats Stats,
    IReadOnlyList<ShowcaseTimelineEvent> Timeline
);

public record ShowcaseStats(
    int IssuesCreated,
    int PrsTotal,
    int PrsMerged,
    int LinesAdded,
    int LinesRemoved,
    int FilesChanged
);

public record ShowcaseTimelineEvent(
    DateTimeOffset Timestamp,
    string Event,
    int Item,
    string Title
);

// Internal JSON deserialization types (snake_case mapping)
internal sealed class ManifestJson
{
    [JsonPropertyName("run")]
    public ManifestRunJson Run { get; set; } = new();

    [JsonPropertyName("issues")]
    public int[] Issues { get; set; } = [];

    [JsonPropertyName("pull_requests")]
    public int[] PullRequests { get; set; } = [];
}

internal sealed class ManifestRunJson
{
    [JsonPropertyName("number")]
    public int Number { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("tag")]
    public string Tag { get; set; } = string.Empty;

    [JsonPropertyName("tech_stack")]
    public string TechStack { get; set; } = string.Empty;

    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;

    [JsonPropertyName("deployment")]
    public string? Deployment { get; set; }

    [JsonPropertyName("prd")]
    public string Prd { get; set; } = string.Empty;
}

internal sealed class RunDataJson
{
    [JsonPropertyName("run")]
    public ManifestRunJson Run { get; set; } = new();

    [JsonPropertyName("stats")]
    public RunDataStatsJson Stats { get; set; } = new();

    [JsonPropertyName("timeline")]
    public TimelineEventJson[] Timeline { get; set; } = [];
}

internal sealed class RunDataStatsJson
{
    [JsonPropertyName("issues_created")]
    public int IssuesCreated { get; set; }

    [JsonPropertyName("prs_total")]
    public int PrsTotal { get; set; }

    [JsonPropertyName("prs_merged")]
    public int PrsMerged { get; set; }

    [JsonPropertyName("lines_added")]
    public int LinesAdded { get; set; }

    [JsonPropertyName("lines_removed")]
    public int LinesRemoved { get; set; }

    [JsonPropertyName("files_changed")]
    public int FilesChanged { get; set; }
}

internal sealed class TimelineEventJson
{
    [JsonPropertyName("timestamp")]
    public DateTimeOffset Timestamp { get; set; }

    [JsonPropertyName("event")]
    public string Event { get; set; } = string.Empty;

    [JsonPropertyName("item")]
    public int Item { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
}
