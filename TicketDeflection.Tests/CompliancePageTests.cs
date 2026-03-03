using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Tests;

public class CompliancePageTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _rootFactory;
    private readonly WebApplicationFactory<Program> _factory;

    public CompliancePageTests(WebApplicationFactory<Program> factory)
    {
        _rootFactory = factory;
        _factory = factory.WithTestAuth();
    }

    [Fact]
    public async Task CompliancePage_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/compliance");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CompliancePage_Returns200_With_Sqlite()
    {
        var tempDir = CreateTempDirectory();
        try
        {
            var dbPath = Path.Combine(tempDir, "ticketdb.db");
            await using var factory = _rootFactory.WithTestAuthSqlite($"Data Source={dbPath}");
            var client = factory.CreateClient();

            var response = await client.GetAsync("/compliance");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        finally
        {
            Directory.Delete(tempDir, recursive: true);
        }
    }

    [Fact]
    public async Task CompliancePage_RendersRefreshHealthIndicator_AndNoTemplateComments()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/compliance");

        Assert.Contains("id=\"refresh-status\"", html);
        Assert.Contains("live refresh connected", html);
        Assert.Contains("live refresh degraded", html);
        Assert.Contains("setRefreshError", html);
        Assert.DoesNotContain("catch (_) {}", html);
        Assert.DoesNotContain("{{!--", html);
    }

    [Fact]
    public async Task CompliancePage_ServerRenderedMetrics_UseFullScanCount()
    {
        var dbName = $"CompliancePageTestDb_{Guid.NewGuid()}";
        await using var factory = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, dbName);
            }));

        var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
            db.ComplianceScans.AddRange(Enumerable.Range(0, 55).Select(i => new ComplianceScan
            {
                ContentType = ContentType.LOG,
                SourceLabel = $"bulk-{i}",
                Disposition = ComplianceDisposition.ADVISORY,
                IsDemo = false,
                SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(i)
            }));
            db.SaveChanges();
        }

        var html = await client.GetStringAsync("/compliance");

        Assert.Equal("60", ExtractElementTextById(html, "m-total"));
    }

    private static string ExtractElementTextById(string html, string elementId)
    {
        var match = Regex.Match(
            html,
            $@"id=""{Regex.Escape(elementId)}""[^>]*>([^<]+)<",
            RegexOptions.IgnoreCase);

        Assert.True(match.Success, $"Could not find element with id '{elementId}'.");
        return match.Groups[1].Value.Trim();
    }

    private static string CreateTempDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), $"TicketDeflectionTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(path);
        return path;
    }
}
