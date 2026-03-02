using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class GitHubPipelineSnapshotServiceTests
{
    [Fact]
    public async Task GetSnapshotAsync_MapsCurrentGitHubStateIntoPipelineSnapshot()
    {
        var handler = new StubHttpMessageHandler(request =>
        {
            var path = request.RequestUri?.PathAndQuery ?? string.Empty;

            return path switch
            {
                "/repos/demo/repo/issues?labels=pipeline&state=open&per_page=100" => JsonResponse("""
                    [
                      {
                        "number": 101,
                        "title": "[Pipeline] Build the queue",
                        "body": "Implement queue",
                        "html_url": "https://github.com/demo/repo/issues/101",
                        "created_at": "2026-03-02T20:00:00Z",
                        "updated_at": "2026-03-02T20:01:00Z",
                        "labels": [{"name":"pipeline"},{"name":"feature"}]
                      },
                      {
                        "number": 102,
                        "title": "[Pipeline] Render live pipeline page",
                        "body": "Implement page",
                        "html_url": "https://github.com/demo/repo/issues/102",
                        "created_at": "2026-03-02T20:02:00Z",
                        "updated_at": "2026-03-02T20:03:00Z",
                        "labels": [{"name":"pipeline"},{"name":"feature"}]
                      },
                      {
                        "number": 103,
                        "title": "[Pipeline] Status",
                        "body": "report",
                        "html_url": "https://github.com/demo/repo/issues/103",
                        "created_at": "2026-03-02T20:04:00Z",
                        "updated_at": "2026-03-02T20:05:00Z",
                        "labels": [{"name":"pipeline"},{"name":"report"}]
                      }
                    ]
                    """),
                "/repos/demo/repo/pulls?state=open&per_page=100" => JsonResponse("""
                    [
                      {
                        "number": 201,
                        "title": "[Pipeline] Render live pipeline page",
                        "body": "Closes #102",
                        "html_url": "https://github.com/demo/repo/pull/201",
                        "created_at": "2026-03-02T20:10:00Z",
                        "updated_at": "2026-03-02T20:11:00Z",
                        "head": {
                          "ref": "repo-assist/issue-102-live-pipeline",
                          "sha": "abc123"
                        },
                        "auto_merge": {
                          "enabled_by": true
                        }
                      }
                    ]
                    """),
                "/repos/demo/repo/actions/runs?status=in_progress&per_page=100" => JsonResponse("""
                    {
                      "workflow_runs": [
                        {
                          "id": 11,
                          "name": "Pipeline Repo Assist",
                          "status": "in_progress",
                          "conclusion": null,
                          "event": "workflow_dispatch",
                          "html_url": "https://github.com/demo/repo/actions/runs/11",
                          "created_at": "2026-03-02T20:12:00Z",
                          "run_started_at": "2026-03-02T20:12:10Z",
                          "head_branch": "main",
                          "head_sha": "def456",
                          "triggering_actor": { "login": "samuelkahessay" }
                        },
                        {
                          "id": 12,
                          "name": "Deploy Router",
                          "status": "in_progress",
                          "conclusion": null,
                          "event": "push",
                          "html_url": "https://github.com/demo/repo/actions/runs/12",
                          "created_at": "2026-03-02T20:13:00Z",
                          "run_started_at": "2026-03-02T20:13:05Z",
                          "head_branch": "main",
                          "head_sha": "ghi789",
                          "triggering_actor": { "login": "samuelkahessay" }
                        }
                      ]
                    }
                    """),
                "/repos/demo/repo/issues/101/comments?per_page=100" => JsonResponse("""
                    [
                      {
                        "body": "<!-- self-healing-dispatch:v1 -->",
                        "html_url": "https://github.com/demo/repo/issues/101#issuecomment-1",
                        "created_at": "2026-03-02T20:02:30Z"
                      }
                    ]
                    """),
                "/repos/demo/repo/issues/102/comments?per_page=100" => JsonResponse("[]"),
                "/repos/demo/repo/pulls/201/reviews?per_page=100" => JsonResponse("""
                    [
                      {
                        "state": "APPROVED",
                        "body": "Looks good",
                        "submitted_at": "2026-03-02T20:14:00Z",
                        "user": { "login": "github-actions[bot]" }
                      }
                    ]
                    """),
                "/repos/demo/repo/commits/abc123/check-runs?per_page=100" => JsonResponse("""
                    {
                      "check_runs": [
                        {
                          "name": ".NET CI",
                          "status": "completed",
                          "conclusion": "success",
                          "html_url": "https://github.com/demo/repo/actions/runs/13"
                        }
                      ]
                    }
                    """),
                _ => new HttpResponseMessage(HttpStatusCode.NotFound)
            };
        });

        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.github.com/")
        };

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GitHub:Repository"] = "demo/repo",
                ["GitHub:Token"] = "test-token"
            })
            .Build();

        var service = new GitHubPipelineSnapshotService(
            httpClient,
            configuration,
            NullLogger<GitHubPipelineSnapshotService>.Instance);

        var snapshot = await service.GetSnapshotAsync();

        Assert.Equal("demo/repo", snapshot.Repository);
        Assert.Equal("authenticated", snapshot.Mode);
        Assert.Equal(2, snapshot.Summary.OpenIssues);
        Assert.Equal(1, snapshot.Summary.OpenPullRequests);
        Assert.Equal(2, snapshot.Summary.ActiveRuns);
        Assert.Contains(snapshot.Issues, issue => issue.Number == 101 && issue.Stage == "implementation_running");
        Assert.Contains(snapshot.Issues, issue => issue.Number == 102 && issue.Stage == "pull_request_open");
        Assert.DoesNotContain(snapshot.Issues, issue => issue.Number == 103);
        Assert.Contains(snapshot.PullRequests, pr => pr.Number == 201 && pr.Stage == "auto_merge_armed");
        Assert.Contains(snapshot.ActiveRuns, run => run.Name == "Deploy Router" && run.Stage == "deploy");
        Assert.Equal(4, snapshot.Stages.Count);
    }

    [Fact]
    public async Task GetSnapshotAsync_AddsWarningWhenGitHubAccessIsUnauthenticated()
    {
        var handler = new StubHttpMessageHandler(request =>
        {
            var path = request.RequestUri?.PathAndQuery ?? string.Empty;
            return path switch
            {
                "/repos/demo/repo/issues?labels=pipeline&state=open&per_page=100" => JsonResponse("[]"),
                "/repos/demo/repo/pulls?state=open&per_page=100" => JsonResponse("[]"),
                "/repos/demo/repo/actions/runs?status=in_progress&per_page=100" => JsonResponse("""{"workflow_runs": []}"""),
                _ => new HttpResponseMessage(HttpStatusCode.NotFound)
            };
        });

        var service = new GitHubPipelineSnapshotService(
            new HttpClient(handler) { BaseAddress = new Uri("https://api.github.com/") },
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GitHub:Repository"] = "demo/repo"
            }).Build(),
            NullLogger<GitHubPipelineSnapshotService>.Instance);

        var snapshot = await service.GetSnapshotAsync();

        Assert.Equal("unauthenticated", snapshot.Mode);
        Assert.Empty(snapshot.Warnings);
        Assert.Empty(snapshot.Issues);
        Assert.Empty(snapshot.PullRequests);
    }

    private static HttpResponseMessage JsonResponse(string json)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_handler(request));
        }
    }
}
