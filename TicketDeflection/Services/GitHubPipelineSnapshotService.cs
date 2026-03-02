using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace TicketDeflection.Services;

public sealed partial class GitHubPipelineSnapshotService : IGitHubPipelineSnapshotService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly ILogger<GitHubPipelineSnapshotService> _logger;
    private readonly string _owner;
    private readonly string _repo;
    private readonly bool _hasToken;

    public GitHubPipelineSnapshotService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GitHubPipelineSnapshotService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        var configuredRepo = configuration["GitHub:Repository"]
            ?? Environment.GetEnvironmentVariable("GITHUB_REPOSITORY")
            ?? "samuelkahessay/prd-to-prod";

        var configuredOwner = configuration["GitHub:RepoOwner"];
        var configuredName = configuration["GitHub:RepoName"];
        var repoParts = configuredRepo.Split('/', 2, StringSplitOptions.RemoveEmptyEntries);
        _owner = !string.IsNullOrWhiteSpace(configuredOwner)
            ? configuredOwner
            : repoParts.ElementAtOrDefault(0) ?? "samuelkahessay";
        _repo = !string.IsNullOrWhiteSpace(configuredName)
            ? configuredName
            : repoParts.ElementAtOrDefault(1) ?? "prd-to-prod";

        var token = configuration["GitHub:Token"]
            ?? Environment.GetEnvironmentVariable("GH_AW_GITHUB_TOKEN")
            ?? Environment.GetEnvironmentVariable("GITHUB_TOKEN");

        _hasToken = !string.IsNullOrWhiteSpace(token);

        _httpClient.BaseAddress ??= new Uri(configuration["GitHub:ApiBaseUrl"] ?? "https://api.github.com/");
        if (_httpClient.DefaultRequestHeaders.UserAgent.Count == 0)
        {
            _httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("prd-to-prod", "1.0"));
        }

        if (!_httpClient.DefaultRequestHeaders.Accept.Any())
        {
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        }

        if (!_httpClient.DefaultRequestHeaders.Contains("X-GitHub-Api-Version"))
        {
            _httpClient.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
        }

        if (_hasToken && _httpClient.DefaultRequestHeaders.Authorization is null)
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
    }

    public async Task<PipelineLiveSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var warnings = new ConcurrentBag<string>();

        var issuesTask = GetOpenPipelineIssuesAsync(warnings, cancellationToken);
        var pullRequestsTask = GetOpenPipelinePullRequestsAsync(warnings, cancellationToken);
        var runsTask = GetInProgressRunsAsync(warnings, cancellationToken);

        await Task.WhenAll(issuesTask, pullRequestsTask, runsTask);

        var issues = await issuesTask;
        var pullRequests = await pullRequestsTask;
        var activeRuns = (await runsTask)
            .Select(MapWorkflowRun)
            .OrderByDescending(run => ParseTimestamp(run.RunStartedAt ?? run.CreatedAt))
            .ToList();

        var linkedIssueNumbers = pullRequests
            .Select(pr => new { pr.Number, IssueNumber = ExtractLinkedIssueNumber(pr.Body) })
            .Where(item => item.IssueNumber.HasValue)
            .ToDictionary(item => item.Number, item => item.IssueNumber!.Value);

        var issueCommentsTasks = issues.ToDictionary(
            issue => issue.Number,
            issue => GetIssueCommentsAsync(issue.Number, warnings, cancellationToken));
        var reviewTasks = pullRequests.ToDictionary(
            pr => pr.Number,
            pr => GetPullRequestReviewsAsync(pr.Number, warnings, cancellationToken));
        var checkRunTasks = pullRequests.ToDictionary(
            pr => pr.Number,
            pr => GetCheckRunsAsync(pr.Head.Sha, warnings, cancellationToken));

        await Task.WhenAll(
            issueCommentsTasks.Values
                .Cast<Task>()
                .Concat(reviewTasks.Values.Cast<Task>())
                .Concat(checkRunTasks.Values.Cast<Task>()));

        var issueByLinkedPullRequest = pullRequests
            .Select(pr => new
            {
                PullRequest = pr,
                IssueNumber = ExtractLinkedIssueNumber(pr.Body)
            })
            .Where(item => item.IssueNumber.HasValue)
            .ToDictionary(item => item.IssueNumber!.Value, item => item.PullRequest);

        var issueStates = issues
            .Select(issue =>
            {
                issueCommentsTasks.TryGetValue(issue.Number, out var commentsTask);
                var comments = commentsTask?.Result ?? [];
                issueByLinkedPullRequest.TryGetValue(issue.Number, out var linkedPr);
                return BuildIssueState(issue, comments, linkedPr);
            })
            .OrderBy(issue => issue.Number)
            .ToList();

        var pullRequestStates = pullRequests
            .Select(pr =>
            {
                reviewTasks.TryGetValue(pr.Number, out var reviewsTask);
                checkRunTasks.TryGetValue(pr.Number, out var checkRunsTask);
                linkedIssueNumbers.TryGetValue(pr.Number, out var linkedIssueNumber);

                var reviews = reviewsTask?.Result ?? [];
                var checkRuns = checkRunsTask?.Result?.CheckRuns ?? [];

                return BuildPullRequestState(pr, reviews, checkRuns, linkedIssueNumber == 0 ? null : linkedIssueNumber);
            })
            .OrderBy(pr => pr.Number)
            .ToList();

        var summary = new PipelineLiveSummary(
            OpenIssues: issueStates.Count,
            OpenPullRequests: pullRequestStates.Count,
            ActiveRuns: activeRuns.Count,
            DeferredIssues: issueStates.Count(issue => issue.Stage == "dispatch_deferred"),
            RepairLoops: issueStates.Count(issue => issue.Stage == "repair_requested"),
            AutoMergeArmed: pullRequestStates.Count(pr => pr.AutoMergeEnabled),
            Deploying: activeRuns.Count(run => run.Stage == "deploy"));

        return new PipelineLiveSnapshot(
            Repository: $"{_owner}/{_repo}",
            UpdatedAtUtc: DateTime.UtcNow.ToString("O"),
            Mode: _hasToken ? "authenticated" : "unauthenticated",
            Warnings: warnings.Distinct(StringComparer.Ordinal).Order().ToList(),
            Summary: summary,
            Stages: BuildStageSummary(issueStates, pullRequestStates, activeRuns),
            Issues: issueStates,
            PullRequests: pullRequestStates,
            ActiveRuns: activeRuns);
    }

    private async Task<List<GitHubIssue>> GetOpenPipelineIssuesAsync(ConcurrentBag<string> warnings, CancellationToken cancellationToken)
    {
        var issues = await GetAsync<List<GitHubIssue>>(
            $"repos/{_owner}/{_repo}/issues?labels=pipeline&state=open&per_page=100",
            warnings,
            cancellationToken) ?? [];

        return issues
            .Where(issue => issue.PullRequest is null)
            .Where(IsActionablePipelineIssue)
            .ToList();
    }

    private async Task<List<GitHubPullRequest>> GetOpenPipelinePullRequestsAsync(ConcurrentBag<string> warnings, CancellationToken cancellationToken)
    {
        var pullRequests = await GetAsync<List<GitHubPullRequest>>(
            $"repos/{_owner}/{_repo}/pulls?state=open&per_page=100",
            warnings,
            cancellationToken) ?? [];

        return pullRequests
            .Where(pr => pr.Title.StartsWith("[Pipeline]", StringComparison.Ordinal))
            .ToList();
    }

    private async Task<List<GitHubWorkflowRun>> GetInProgressRunsAsync(ConcurrentBag<string> warnings, CancellationToken cancellationToken)
    {
        var response = await GetAsync<GitHubRunsResponse>(
            $"repos/{_owner}/{_repo}/actions/runs?status=in_progress&per_page=100",
            warnings,
            cancellationToken);

        return response?.WorkflowRuns ?? [];
    }

    private async Task<List<GitHubComment>> GetIssueCommentsAsync(int issueNumber, ConcurrentBag<string> warnings, CancellationToken cancellationToken)
    {
        return await GetAsync<List<GitHubComment>>(
            $"repos/{_owner}/{_repo}/issues/{issueNumber}/comments?per_page=100",
            warnings,
            cancellationToken) ?? [];
    }

    private async Task<List<GitHubReview>> GetPullRequestReviewsAsync(int pullRequestNumber, ConcurrentBag<string> warnings, CancellationToken cancellationToken)
    {
        return await GetAsync<List<GitHubReview>>(
            $"repos/{_owner}/{_repo}/pulls/{pullRequestNumber}/reviews?per_page=100",
            warnings,
            cancellationToken) ?? [];
    }

    private async Task<GitHubCheckRunsResponse?> GetCheckRunsAsync(string sha, ConcurrentBag<string> warnings, CancellationToken cancellationToken)
    {
        return await GetAsync<GitHubCheckRunsResponse>(
            $"repos/{_owner}/{_repo}/commits/{sha}/check-runs?per_page=100",
            warnings,
            cancellationToken);
    }

    private async Task<T?> GetAsync<T>(string path, ConcurrentBag<string> warnings, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        using var response = await _httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var detail = response.ReasonPhrase ?? response.StatusCode.ToString();
            warnings.Add($"GitHub API returned {(int)response.StatusCode} for {path}: {detail}.");
            _logger.LogWarning("GitHub API returned {StatusCode} for {Path}", (int)response.StatusCode, path);
            return default;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOpts, cancellationToken);
    }

    private static bool IsActionablePipelineIssue(GitHubIssue issue)
    {
        var labels = issue.Labels
            .Select(label => label.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (issue.Title.StartsWith("[CI Incident]", StringComparison.Ordinal))
            return true;

        return labels.Contains("pipeline")
            && (labels.Contains("feature")
                || labels.Contains("bug")
                || labels.Contains("infra")
                || labels.Contains("docs")
                || labels.Contains("test"));
    }

    private static PipelineIssueState BuildIssueState(
        GitHubIssue issue,
        IReadOnlyList<GitHubComment> comments,
        GitHubPullRequest? linkedPullRequest)
    {
        var labels = issue.Labels.Select(label => label.Name).ToList();
        var marker = DetectMarker(comments);

        var (stage, stageLabel) = linkedPullRequest is not null
            ? ("pull_request_open", "PR open")
            : marker switch
            {
                "ci_repair" => ("repair_requested", "Repair requested"),
                "dispatch" => ("implementation_running", "Implementation running"),
                "dispatch_deferred" => ("dispatch_deferred", "Dispatch deferred"),
                _ when issue.Title.StartsWith("[CI Incident]", StringComparison.Ordinal) => ("incident_open", "Incident open"),
                _ => ("queued", "Queued")
            };

        return new PipelineIssueState(
            Number: issue.Number,
            Title: issue.Title,
            Url: issue.HtmlUrl,
            Stage: stage,
            StageLabel: stageLabel,
            CreatedAt: issue.CreatedAt,
            UpdatedAt: issue.UpdatedAt,
            Labels: labels,
            LinkedPullRequestNumber: linkedPullRequest?.Number,
            LinkedPullRequestUrl: linkedPullRequest?.HtmlUrl,
            Marker: marker);
    }

    private static PipelinePullRequestState BuildPullRequestState(
        GitHubPullRequest pullRequest,
        IReadOnlyList<GitHubReview> reviews,
        IReadOnlyList<GitHubCheckRun> checkRuns,
        int? linkedIssueNumber)
    {
        var ciState = ClassifyCiState(checkRuns);
        var reviewState = ClassifyReviewState(reviews);

        var (stage, stageLabel) = ciState switch
        {
            "running" => ("ci_running", "CI running"),
            "pending" => ("ci_pending", "CI pending"),
            "failed" => ("ci_failed", "CI failed"),
            _ => reviewState switch
            {
                "CHANGES_REQUESTED" => ("changes_requested", "Changes requested"),
                "APPROVED" when pullRequest.AutoMerge is not null => ("auto_merge_armed", "Auto-merge armed"),
                "APPROVED" => ("approved_waiting_merge", "Approved"),
                _ => ("review_pending", "Review pending")
            }
        };

        return new PipelinePullRequestState(
            Number: pullRequest.Number,
            Title: pullRequest.Title,
            Url: pullRequest.HtmlUrl,
            HeadSha: pullRequest.Head.Sha,
            HeadBranch: pullRequest.Head.Ref,
            Stage: stage,
            StageLabel: stageLabel,
            CiState: ciState,
            ReviewState: reviewState,
            AutoMergeEnabled: pullRequest.AutoMerge is not null,
            LinkedIssueNumber: linkedIssueNumber,
            CreatedAt: pullRequest.CreatedAt,
            UpdatedAt: pullRequest.UpdatedAt);
    }

    private static IReadOnlyList<PipelineStageSummary> BuildStageSummary(
        IReadOnlyList<PipelineIssueState> issues,
        IReadOnlyList<PipelinePullRequestState> pullRequests,
        IReadOnlyList<PipelineWorkflowRunState> activeRuns)
    {
        var queueCount = issues.Count(issue =>
            issue.Stage is "queued" or "dispatch_deferred" or "incident_open" or "repair_requested");
        var implementationCount = issues.Count(issue =>
                issue.Stage is "implementation_running" or "pull_request_open")
            + activeRuns.Count(run => run.Stage == "implementation");
        var reviewCount = pullRequests.Count(pr =>
                pr.Stage is "review_pending" or "changes_requested" or "approved_waiting_merge" or "auto_merge_armed")
            + activeRuns.Count(run => run.Stage == "review");
        var deployCount = activeRuns.Count(run => run.Stage == "deploy");

        return
        [
            new PipelineStageSummary("queue", "Queue", queueCount, queueCount > 0 ? "active" : "idle"),
            new PipelineStageSummary("implementation", "Implement", implementationCount, implementationCount > 0 ? "active" : "idle"),
            new PipelineStageSummary("review", "Review", reviewCount, reviewCount > 0 ? "active" : "idle"),
            new PipelineStageSummary("deploy", "Deploy", deployCount, deployCount > 0 ? "active" : "idle")
        ];
    }

    private static PipelineWorkflowRunState MapWorkflowRun(GitHubWorkflowRun run)
    {
        var stage = ClassifyWorkflowStage(run.Name);
        return new PipelineWorkflowRunState(
            Id: run.Id,
            Name: run.Name,
            Stage: stage,
            StageLabel: StageLabelForRun(stage),
            Event: run.Event,
            Status: run.Status,
            Conclusion: run.Conclusion,
            Url: run.HtmlUrl,
            CreatedAt: run.CreatedAt,
            RunStartedAt: run.RunStartedAt,
            HeadBranch: run.HeadBranch,
            HeadSha: run.HeadSha,
            TriggeringActor: run.TriggeringActor?.Login);
    }

    private static string DetectMarker(IReadOnlyList<GitHubComment> comments)
    {
        if (comments.Any(comment => comment.Body.Contains("<!-- ci-repair-command:v1 -->", StringComparison.Ordinal)))
            return "ci_repair";
        if (comments.Any(comment => comment.Body.Contains("<!-- self-healing-dispatch:v1 -->", StringComparison.Ordinal)))
            return "dispatch";
        if (comments.Any(comment => comment.Body.Contains("<!-- self-healing-dispatch-deferred:v1 -->", StringComparison.Ordinal)))
            return "dispatch_deferred";
        return "none";
    }

    private static string ClassifyCiState(IReadOnlyList<GitHubCheckRun> checkRuns)
    {
        if (checkRuns.Count == 0)
            return "pending";
        if (checkRuns.Any(run => run.Status is "queued" or "in_progress" or "pending"))
            return "running";
        if (checkRuns.Any(run => run.Conclusion is "failure" or "cancelled" or "timed_out" or "action_required"))
            return "failed";
        if (checkRuns.All(run => run.Conclusion == "success"))
            return "passed";
        return "pending";
    }

    private static string ClassifyReviewState(IReadOnlyList<GitHubReview> reviews)
    {
        return reviews
            .Where(review => !string.IsNullOrWhiteSpace(review.State))
            .OrderByDescending(review => ParseTimestamp(review.SubmittedAt))
            .Select(review => review.State)
            .FirstOrDefault(state => state is "APPROVED" or "CHANGES_REQUESTED")
            ?? "PENDING";
    }

    private static string ClassifyWorkflowStage(string workflowName)
    {
        if (workflowName.Contains("Repo Assist", StringComparison.OrdinalIgnoreCase))
            return "implementation";
        if (workflowName.Contains("Review", StringComparison.OrdinalIgnoreCase))
            return "review";
        if (workflowName.Contains("Deploy", StringComparison.OrdinalIgnoreCase))
            return "deploy";
        if (workflowName.Contains("Auto-Dispatch", StringComparison.OrdinalIgnoreCase)
            || workflowName.Contains("PRD Decomposer", StringComparison.OrdinalIgnoreCase)
            || workflowName.Contains("Pipeline Status", StringComparison.OrdinalIgnoreCase))
            return "queue";
        return "operations";
    }

    private static string StageLabelForRun(string stage) => stage switch
    {
        "implementation" => "Implementation",
        "review" => "Review",
        "deploy" => "Deploy",
        "queue" => "Queue",
        _ => "Operations"
    };

    private static int? ExtractLinkedIssueNumber(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;

        var match = LinkedIssueRegex().Match(body);
        return match.Success && int.TryParse(match.Groups["issue"].Value, out var issueNumber)
            ? issueNumber
            : null;
    }

    private static DateTimeOffset ParseTimestamp(string? value)
    {
        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : DateTimeOffset.MinValue;
    }

    [GeneratedRegex(@"(?im)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(?<issue>\d+)\b")]
    private static partial Regex LinkedIssueRegex();

    private sealed record GitHubIssue(
        int Number,
        string Title,
        string? Body,
        string HtmlUrl,
        string CreatedAt,
        string UpdatedAt,
        List<GitHubLabel> Labels,
        GitHubPullRequestMarker? PullRequest);

    private sealed record GitHubPullRequest(
        int Number,
        string Title,
        string? Body,
        string HtmlUrl,
        string CreatedAt,
        string UpdatedAt,
        GitHubHead Head,
        GitHubAutoMerge? AutoMerge);

    private sealed record GitHubRunsResponse(List<GitHubWorkflowRun> WorkflowRuns);

    private sealed record GitHubWorkflowRun(
        long Id,
        string Name,
        string Status,
        string? Conclusion,
        string Event,
        string HtmlUrl,
        string CreatedAt,
        string? RunStartedAt,
        string? HeadBranch,
        string? HeadSha,
        GitHubUser? TriggeringActor);

    private sealed record GitHubComment(string Body, string HtmlUrl, string CreatedAt);

    private sealed record GitHubReview(string State, string? Body, string? SubmittedAt, GitHubUser? User);

    private sealed record GitHubCheckRunsResponse(List<GitHubCheckRun> CheckRuns);

    private sealed record GitHubCheckRun(string Name, string Status, string? Conclusion, string HtmlUrl);

    private sealed record GitHubLabel(string Name);

    private sealed record GitHubPullRequestMarker(string Url);

    private sealed record GitHubHead(string Ref, string Sha);

    private sealed record GitHubAutoMerge(bool EnabledBy);

    private sealed record GitHubUser(string Login);
}
