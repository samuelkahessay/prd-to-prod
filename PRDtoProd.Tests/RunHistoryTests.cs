using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using PRDtoProd.Models;
using PRDtoProd.Services;

namespace PRDtoProd.Tests;

/// <summary>Stub IShowcaseService returning fixed test data.</summary>
internal sealed class StubShowcaseService : IShowcaseService
{
    private readonly IReadOnlyList<ShowcaseRun> _runs;

    public StubShowcaseService(IReadOnlyList<ShowcaseRun> runs) => _runs = runs;

    public Task<IReadOnlyList<ShowcaseRun>> GetCompletedRunsAsync() =>
        Task.FromResult(_runs);

    public Task<ShowcaseRunDetail?> GetRunDetailAsync(string slug) =>
        Task.FromResult<ShowcaseRunDetail?>(null);
}

public class RunHistoryTests
{
    private static WebApplicationFactory<Program> CreateFactory(IReadOnlyList<ShowcaseRun> runs)
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");

                // Remove all IShowcaseService registrations and replace with stub
                foreach (var d in services.Where(d => d.ServiceType == typeof(IShowcaseService)).ToList())
                    services.Remove(d);

                services.AddSingleton<IShowcaseService>(new StubShowcaseService(runs));
            });
        });
    }

    [Fact]
    public async Task EvidenceStrip_RendersRunCount()
    {
        var runs = new List<ShowcaseRun>
        {
            new("test-run-01", 1, "Alpha App", "v1.0.0", "TypeScript", "2025-01", null, "docs/prd/alpha.md", 5, 6),
            new("test-run-02", 2, "Beta App",  "v2.0.0", "Python",     "2025-06", null, "docs/prd/beta.md",  8, 9),
        };

        using var factory = CreateFactory(runs);
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        Assert.Contains("pipeline runs", html);
        Assert.Contains("issues resolved", html);
        Assert.Contains("PRs merged", html);
    }

    [Fact]
    public async Task EvidenceStrip_ShowsZeroWhenNoRuns()
    {
        using var factory = CreateFactory(new List<ShowcaseRun>());
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        // The evidence strip renders value and label in separate divs:
        // <div class="evidence-val">0</div>
        // <div class="evidence-lbl">pipeline runs</div>
        Assert.Contains("pipeline runs", html);
        Assert.Contains("class=\"metric-val\">0<", html);
    }

    [Fact]
    public async Task EvidenceStrip_ContainsPipelineLabels()
    {
        var runs = new List<ShowcaseRun>
        {
            new("run-01", 1, "Test App", "v1.0.0", "Go", "2025-01", null, "docs/prd/test.md", 3, 4),
        };

        using var factory = CreateFactory(runs);
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        Assert.Contains("pipeline runs", html);
        Assert.Contains("fastest PRD-to-ship", html);
    }

    [Fact]
    public async Task EvidenceStrip_TotalsMatchAggregatedData()
    {
        var runs = new List<ShowcaseRun>
        {
            new("run-01", 1, "First",  "v1.0.0", "Node", "2025-01", null, "docs/prd/first.md",  4, 5),
            new("run-02", 2, "Second", "v2.0.0", "Go",   "2025-06", null, "docs/prd/second.md", 6, 7),
        };

        using var factory = CreateFactory(runs);
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        // TotalIssues = 4+6 = 10, TotalPrs = 5+7 = 12
        Assert.Contains("10+", html);
        Assert.Contains("12+", html);
    }
}
