namespace TicketDeflection.Services;

public interface IGitHubPipelineSnapshotService
{
    Task<PipelineLiveSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default);
}

public sealed record PipelineLiveSnapshot(
    string Repository,
    string UpdatedAtUtc,
    string Mode,
    IReadOnlyList<string> Warnings,
    PipelineLiveSummary Summary,
    IReadOnlyList<PipelineStageSummary> Stages,
    IReadOnlyList<PipelineIssueState> Issues,
    IReadOnlyList<PipelinePullRequestState> PullRequests,
    IReadOnlyList<PipelineWorkflowRunState> ActiveRuns
);

public sealed record PipelineLiveSummary(
    int OpenIssues,
    int OpenPullRequests,
    int ActiveRuns,
    int DeferredIssues,
    int RepairLoops,
    int AutoMergeArmed,
    int Deploying
);

public sealed record PipelineStageSummary(
    string Key,
    string Label,
    int Count,
    string Status
);

public sealed record PipelineIssueState(
    int Number,
    string Title,
    string Url,
    string Stage,
    string StageLabel,
    string CreatedAt,
    string UpdatedAt,
    IReadOnlyList<string> Labels,
    int? LinkedPullRequestNumber,
    string? LinkedPullRequestUrl,
    string? Marker
);

public sealed record PipelinePullRequestState(
    int Number,
    string Title,
    string Url,
    string HeadSha,
    string HeadBranch,
    string Stage,
    string StageLabel,
    string CiState,
    string ReviewState,
    bool AutoMergeEnabled,
    int? LinkedIssueNumber,
    string CreatedAt,
    string UpdatedAt
);

public sealed record PipelineWorkflowRunState(
    long Id,
    string Name,
    string Stage,
    string StageLabel,
    string Event,
    string Status,
    string? Conclusion,
    string Url,
    string CreatedAt,
    string? RunStartedAt,
    string? HeadBranch,
    string? HeadSha,
    string? TriggeringActor
);
