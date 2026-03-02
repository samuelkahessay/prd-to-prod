using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TicketDeflection.Models;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

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
                // Remove the real ShowcaseService and replace with stub
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(IShowcaseService));
                if (descriptor != null)
                    services.Remove(descriptor);

                services.AddSingleton<IShowcaseService>(new StubShowcaseService(runs));
            });
        });
    }

    [Fact]
    public async Task RunHistory_RendersRunsFromService()
    {
        var runs = new List<ShowcaseRun>
        {
            new("test-run-01", 1, "Alpha App", "v1.0.0", "TypeScript", "2025-01", null, "docs/prd/alpha.md", 5, 6),
            new("test-run-02", 2, "Beta App",  "v2.0.0", "Python",     "2025-06", null, "docs/prd/beta.md",  8, 9),
        };

        using var factory = CreateFactory(runs);
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        Assert.Contains("Alpha App", html);
        Assert.Contains("Beta App", html);
        Assert.Contains("ACTIVE", html);   // most recent run is marked active
        Assert.Contains("merged", html);   // earlier runs are marked merged
        Assert.Contains("CODENAME", html);
        Assert.Contains("STATUS", html);
    }

    [Fact]
    public async Task RunHistory_ShowsFallback_WhenNoRuns()
    {
        using var factory = CreateFactory(new List<ShowcaseRun>());
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        Assert.Contains("No completed runs yet", html);
    }

    [Fact]
    public async Task RunHistory_RendersColumnHeaders()
    {
        var runs = new List<ShowcaseRun>
        {
            new("run-01", 1, "Test App", "v1.0.0", "Go", "2025-01", null, "docs/prd/test.md", 3, 4),
        };

        using var factory = CreateFactory(runs);
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        Assert.Contains("CODENAME", html);
        Assert.Contains("STACK", html);
        Assert.Contains("ISSUES", html);
        Assert.Contains("STATUS", html);
    }

    [Fact]
    public async Task RunHistory_TotalsMatchAggregatedData()
    {
        var runs = new List<ShowcaseRun>
        {
            new("run-01", 1, "First",  "v1.0.0", "Node", "2025-01", null, "docs/prd/first.md",  4, 5),
            new("run-02", 2, "Second", "v2.0.0", "Go",   "2025-06", null, "docs/prd/second.md", 6, 7),
        };

        using var factory = CreateFactory(runs);
        var client = factory.CreateClient();
        var html = await client.GetStringAsync("/");

        // TotalIssues = 10, TotalPrs = 12, TotalRuns = 2
        Assert.Contains("2 runs", html);
        Assert.Contains("10+", html);
        Assert.Contains("12+", html);
    }
}
