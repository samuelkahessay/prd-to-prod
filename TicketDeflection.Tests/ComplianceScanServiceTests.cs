using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TicketDeflection.Data;
using TicketDeflection.Models;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class ComplianceScanServiceTests
{
    private static TicketDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<TicketDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static IConfiguration CreateConfig(bool allowDemoBypass = false) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ComplianceScanner:AllowDemoBypass"] = allowDemoBypass.ToString()
            })
            .Build();

    private static ComplianceScanService CreateService(bool allowDemoBypass = false) =>
        new(new ComplianceRuleLibrary(), CreateConfig(allowDemoBypass));

    [Fact]
    public async Task SIN_Plaintext_Produces_AutoBlock()
    {
        using var db = CreateContext();
        var svc = CreateService();

        var scan = await svc.ScanAsync("SIN: 123-456-789", ContentType.FREETEXT, null, db);

        Assert.Equal(ComplianceDisposition.AUTO_BLOCK, scan.Disposition);
        Assert.Contains(scan.Findings, f => f.Disposition == ComplianceDisposition.AUTO_BLOCK);
    }

    [Fact]
    public async Task FINTRAC_LargeTransaction_Without_ReportingMarker_Produces_Finding()
    {
        using var db = CreateContext();
        var svc = CreateService();

        var scan = await svc.ScanAsync("amount > 10000 in transaction record", ContentType.FREETEXT, null, db);

        Assert.Contains(scan.Findings, f => f.Regulation == ComplianceRegulation.FINTRAC);
    }

    [Fact]
    public async Task Clean_Content_Produces_Advisory_With_Zero_Findings()
    {
        using var db = CreateContext();
        var svc = CreateService();

        var scan = await svc.ScanAsync("GET /api/health HTTP/1.1 200 OK — no sensitive data", ContentType.FREETEXT, null, db);

        Assert.Equal(ComplianceDisposition.ADVISORY, scan.Disposition);
        Assert.Empty(scan.Findings);
    }

    [Fact]
    public async Task TestContext_Marker_Does_Not_Produce_AutoBlock_When_DemoBypass_Enabled()
    {
        using var db = CreateContext();
        var svc = CreateService(allowDemoBypass: true);

        var scan = await svc.ScanAsync("// test-context\nSIN: 123-456-789", ContentType.FREETEXT, null, db);

        Assert.NotEqual(ComplianceDisposition.AUTO_BLOCK, scan.Disposition);
        Assert.DoesNotContain(scan.Findings, f => f.Disposition == ComplianceDisposition.AUTO_BLOCK);
    }

    [Fact]
    public async Task TestContext_Marker_Still_AutoBlocks_When_DemoBypass_Disabled()
    {
        using var db = CreateContext();
        var svc = CreateService(allowDemoBypass: false);

        var scan = await svc.ScanAsync("// test-context\nSIN: 123-456-789", ContentType.FREETEXT, null, db);

        Assert.Equal(ComplianceDisposition.AUTO_BLOCK, scan.Disposition);
    }

    [Fact]
    public async Task HumanRequired_Findings_Have_NonNull_StopReason()
    {
        using var db = CreateContext();
        var svc = CreateService();

        // DOB exposed — PIPEDA-003 is HUMAN_REQUIRED
        var scan = await svc.ScanAsync("dob: 1990-01-15 in user record", ContentType.FREETEXT, null, db);

        var humanFindings = scan.Findings.Where(f => f.Disposition == ComplianceDisposition.HUMAN_REQUIRED).ToList();
        Assert.NotEmpty(humanFindings);
        Assert.All(humanFindings, f => Assert.NotNull(f.StopReason));
    }

    [Fact]
    public async Task AccountNumber_Returned_In_Api_Response_Produces_HumanRequired()
    {
        using var db = CreateContext();
        var svc = CreateService();

        var content = """
            app.MapGet("/users/{id}", (User user) =>
            {
                return Results.Ok(new { accountNumber = user.AccountNumber });
            });
            """;

        var scan = await svc.ScanAsync(content, ContentType.CODE, "UsersEndpoint.cs", db);

        Assert.Equal(ComplianceDisposition.HUMAN_REQUIRED, scan.Disposition);
        Assert.Contains(
            scan.Findings,
            f => f.RuleId == "PIPEDA-002" && f.Disposition == ComplianceDisposition.HUMAN_REQUIRED);
    }

    [Fact]
    public async Task Acct_Field_Logged_Produces_HumanRequired()
    {
        using var db = CreateContext();
        var svc = CreateService();

        var content = """
            public void LogResponse(User user, ILogger logger)
            {
                logger.LogInformation("Returning acct {acct}", user.Acct);
            }
            """;

        var scan = await svc.ScanAsync(content, ContentType.CODE, "AuditLogger.cs", db);

        Assert.Equal(ComplianceDisposition.HUMAN_REQUIRED, scan.Disposition);
        Assert.Contains(
            scan.Findings,
            f => f.RuleId == "PIPEDA-002" && f.Disposition == ComplianceDisposition.HUMAN_REQUIRED);
    }

    [Fact]
    public async Task AutoBlock_Findings_Have_Null_StopReason()
    {
        using var db = CreateContext();
        var svc = CreateService();

        var scan = await svc.ScanAsync("SIN: 456-789-123", ContentType.FREETEXT, null, db);

        var autoBlockFindings = scan.Findings.Where(f => f.Disposition == ComplianceDisposition.AUTO_BLOCK).ToList();
        Assert.NotEmpty(autoBlockFindings);
        Assert.All(autoBlockFindings, f => Assert.Null(f.StopReason));
    }

    [Fact]
    public async Task Any_AutoBlock_Finding_Sets_Scan_Disposition_To_AutoBlock()
    {
        using var db = CreateContext();
        var svc = CreateService();

        // Contains both AUTO_BLOCK (SIN) and HUMAN_REQUIRED (DOB) content
        var scan = await svc.ScanAsync("SIN: 123-456-789 and dob: 1985-06-20", ContentType.FREETEXT, null, db);

        Assert.Equal(ComplianceDisposition.AUTO_BLOCK, scan.Disposition);
    }

    [Fact]
    public async Task Only_HumanRequired_Findings_Sets_Scan_Disposition_To_HumanRequired()
    {
        using var db = CreateContext();
        var svc = CreateService();

        // DOB triggers HUMAN_REQUIRED but not AUTO_BLOCK
        var scan = await svc.ScanAsync("dob: 1990-01-15 in exported user report", ContentType.FREETEXT, null, db);

        Assert.Equal(ComplianceDisposition.HUMAN_REQUIRED, scan.Disposition);
    }
}
