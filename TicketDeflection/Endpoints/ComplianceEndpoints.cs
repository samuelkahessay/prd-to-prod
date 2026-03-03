#nullable enable

using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Models;
using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class ComplianceEndpoints
{
    // Sample content for the simulate endpoint — mix of PIPEDA, FINTRAC, clean, and advisory
    private static readonly string[] SampleContents =
    [
        // PIPEDA violations (AUTO_BLOCK)
        "Customer data: SIN: 123-456-789, name: Jane Doe",
        "Personal health info: patient SIN 987-654-321, diagnosis: hypertension",
        "SIN: 456-789-123 found in exported log file",
        "Record includes SIN: 111-222-333 and date of birth",
        "Credit card 4111-1111-1111-1111 stored in plaintext",

        // FINTRAC violations (HUMAN_REQUIRED)
        "Transaction of $15,000 CAD deposited without FINTRAC report",
        "Wire transfer $12,500 to foreign account — no STR filed",
        "Cash transaction exceeding $10,000 — reporting status unclear",
        "Transfer amount: $11,200 — compliance officer not notified",
        "Large cash purchase $13,800 — FINTRAC reporting pending",

        // Advisory samples
        "Potential data handling issue — review recommended",
        "Transaction recorded, amount below reporting threshold",
        "User consent obtained — standard processing",
        "Log entry: API call completed, no sensitive data detected",
        "Payment $500 processed — standard threshold",

        // Clean samples
        "Hello world — simple test content with no violations",
        "GET /api/health HTTP/1.1 200 OK",
        "Build succeeded. 0 warnings, 0 errors.",
        "Unit test passed: OrderCalculation returns correct total",
        "README updated with new API documentation",
    ];

    public static void MapComplianceEndpoints(this WebApplication app)
    {
        app.MapPost("/api/scans", SubmitScan).RequireRateLimiting("PublicPost");
        app.MapGet("/api/scans", GetAllScans);
        app.MapGet("/api/scans/{id:guid}", GetScanById);
        app.MapGet("/api/compliance/metrics", GetMetrics);
        app.MapPost("/api/scans/{id:guid}/decision", RecordDecision).RequireAuthorization();
        app.MapPost("/api/scans/simulate", RunComplianceSimulation).RequireAuthorization();
    }

    private static async Task<IResult> SubmitScan(
        ScanRequest request,
        IComplianceScanService scanner,
        TicketDbContext db)
    {
        var scan = await scanner.ScanAsync(request.Content, request.ContentType, request.SourceLabel, db);
        return Results.Created($"/api/scans/{scan.Id}", scan);
    }

    private static async Task<IResult> GetAllScans(TicketDbContext db)
    {
        // SQLite cannot translate DateTimeOffset ORDER BY, so timestamp ordering happens in memory.
        var decisions = await db.ComplianceDecisions
            .AsNoTracking()
            .Select(d => new { d.ScanId, d.Decision, d.DecidedAt })
            .ToListAsync();
        var decisionLookup = decisions
            .GroupBy(d => d.ScanId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderByDescending(d => d.DecidedAt)
                    .Select(d => (ComplianceDecisionType?)d.Decision)
                    .FirstOrDefault());

        var scans = await db.ComplianceScans
            .AsNoTracking()
            .Include(s => s.Findings)
            .ToListAsync();
        scans = scans
            .OrderByDescending(s => s.SubmittedAt)
            .ToList();

        return Results.Ok(scans.Select(scan => new
        {
            scan.Id,
            scan.SubmittedAt,
            scan.ContentType,
            scan.SourceLabel,
            scan.Disposition,
            scan.IsDemo,
            scan.Findings,
            hasDecision = decisionLookup.ContainsKey(scan.Id),
            latestDecision = decisionLookup.GetValueOrDefault(scan.Id),
        }));
    }

    private static async Task<IResult> GetScanById(Guid id, TicketDbContext db)
    {
        var scan = await db.ComplianceScans
            .Include(s => s.Findings)
            .FirstOrDefaultAsync(s => s.Id == id);
        return scan is null ? Results.NotFound() : Results.Ok(scan);
    }

    private static async Task<IResult> GetMetrics(TicketDbContext db)
    {
        var scans = await db.ComplianceScans.ToListAsync();
        var pendingDecisions = await db.ComplianceScans
            .Where(s => s.Disposition == ComplianceDisposition.HUMAN_REQUIRED)
            .CountAsync(s => !db.ComplianceDecisions.Any(d => d.ScanId == s.Id));

        return Results.Ok(new
        {
            totalScans = scans.Count,
            autoBlocked = scans.Count(s => s.Disposition == ComplianceDisposition.AUTO_BLOCK),
            humanRequired = scans.Count(s => s.Disposition == ComplianceDisposition.HUMAN_REQUIRED),
            advisory = scans.Count(s => s.Disposition == ComplianceDisposition.ADVISORY),
            pendingDecisions,
        });
    }

    private static async Task<IResult> RecordDecision(
        Guid id,
        DecisionRequest request,
        HttpContext httpContext,
        TicketDbContext db)
    {
        var scan = await db.ComplianceScans
            .Include(s => s.Findings)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (scan is null)
            return Results.NotFound();

        if (scan.Disposition != ComplianceDisposition.HUMAN_REQUIRED)
            return Results.BadRequest("Decisions can only be recorded on HUMAN_REQUIRED scans");

        var existingDecision = await db.ComplianceDecisions
            .AnyAsync(d => d.ScanId == id);
        if (existingDecision)
            return Results.Conflict("A decision has already been recorded for this scan");

        var operatorId = httpContext.User.Identity?.Name ?? "unknown";

        var decision = new ComplianceDecision
        {
            ScanId = id,
            OperatorId = operatorId,
            Decision = request.Decision,
            Notes = request.Notes,
        };
        db.ComplianceDecisions.Add(decision);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Results.Conflict("A decision has already been recorded for this scan");
        }

        return Results.Ok(scan);
    }

    private static async Task<IResult> RunComplianceSimulation(
        IComplianceScanService scanner,
        TicketDbContext db,
        int count = 10)
    {
        if (count < 1) count = 1;
        if (count > 50) count = 50;

        var random = new Random();
        int autoBlocked = 0, humanRequired = 0, advisory = 0;

        for (int i = 0; i < count; i++)
        {
            var content = SampleContents[random.Next(SampleContents.Length)];
            var scan = await scanner.ScanAsync(content, ContentType.FREETEXT, "simulate", db);
            switch (scan.Disposition)
            {
                case ComplianceDisposition.AUTO_BLOCK: autoBlocked++; break;
                case ComplianceDisposition.HUMAN_REQUIRED: humanRequired++; break;
                default: advisory++; break;
            }
        }

        return Results.Ok(new { count, autoBlocked, humanRequired, advisory });
    }
}

public record ScanRequest(string Content, ContentType ContentType, string? SourceLabel);
public record DecisionRequest(ComplianceDecisionType Decision, string? Notes);
