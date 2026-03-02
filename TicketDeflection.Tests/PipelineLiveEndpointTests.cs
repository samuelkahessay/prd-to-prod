using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class PipelineLiveEndpointTests
{
    [Fact]
    public async Task PipelineLiveEndpoint_ReturnsSnapshotJson()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IGitHubPipelineSnapshotService>();
                services.AddSingleton<IGitHubPipelineSnapshotService>(new StubPipelineSnapshotService());
            });
        });

        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/pipeline/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var json = await JsonDocument.ParseAsync(stream);

        Assert.Equal("demo/repo", json.RootElement.GetProperty("repository").GetString());
        Assert.Equal(1, json.RootElement.GetProperty("summary").GetProperty("openIssues").GetInt32());
    }

    private sealed class StubPipelineSnapshotService : IGitHubPipelineSnapshotService
    {
        public Task<PipelineLiveSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new PipelineLiveSnapshot(
                Repository: "demo/repo",
                UpdatedAtUtc: "2026-03-02T22:20:00Z",
                Mode: "authenticated",
                Warnings: [],
                Summary: new PipelineLiveSummary(1, 1, 1, 0, 0, 1, 0),
                Stages:
                [
                    new PipelineStageSummary("queue", "Queue", 1, "active"),
                    new PipelineStageSummary("implementation", "Implement", 0, "idle"),
                    new PipelineStageSummary("review", "Review", 1, "active"),
                    new PipelineStageSummary("deploy", "Deploy", 0, "idle")
                ],
                Issues:
                [
                    new PipelineIssueState(335, "[Pipeline] Build backend autonomy APIs", "https://github.com/demo/repo/issues/335", "pull_request_open", "PR open", "2026-03-02T22:00:00Z", "2026-03-02T22:05:00Z", ["pipeline", "feature"], 401, "https://github.com/demo/repo/pull/401", "dispatch")
                ],
                PullRequests:
                [
                    new PipelinePullRequestState(401, "[Pipeline] Build backend autonomy APIs", "https://github.com/demo/repo/pull/401", "abc123", "repo-assist/issue-335", "auto_merge_armed", "Auto-merge armed", "passed", "APPROVED", true, 335, "2026-03-02T22:01:00Z", "2026-03-02T22:04:00Z")
                ],
                ActiveRuns:
                [
                    new PipelineWorkflowRunState(99, "Pipeline Repo Assist", "implementation", "Implementation", "workflow_dispatch", "in_progress", null, "https://github.com/demo/repo/actions/runs/99", "2026-03-02T22:06:00Z", "2026-03-02T22:06:05Z", "main", "def456", "samuelkahessay")
                ]));
        }
    }
}
