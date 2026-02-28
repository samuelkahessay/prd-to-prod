using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Endpoints;

public static class MetricsEndpoints
{
    public static void MapMetricsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/metrics/overview", GetOverview);
        app.MapGet("/api/metrics/tickets", GetTickets);
    }

    private static async Task<IResult> GetOverview(TicketDbContext db)
    {
        var tickets = await db.Tickets.ToListAsync();

        var total = tickets.Count;
        var autoResolved = tickets.Count(t => t.Status == TicketStatus.AutoResolved);
        var escalated = tickets.Count(t => t.Status == TicketStatus.Escalated);
        var resolutionRate = total > 0 ? (double)autoResolved / total : 0.0;

        var byCategory = tickets
            .GroupBy(t => t.Category.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        var bySeverity = tickets
            .GroupBy(t => t.Severity.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        return Results.Ok(new MetricsOverview(total, autoResolved, escalated, resolutionRate, byCategory, bySeverity));
    }

    private static async Task<IResult> GetTickets(TicketDbContext db, int limit = 20, int offset = 0)
    {
        var tickets = await db.Tickets
            .OrderByDescending(t => t.CreatedAt)
            .Skip(offset)
            .Take(limit)
            .Select(t => new TicketSummary(
                t.Id, t.Title, t.Category.ToString(), t.Severity.ToString(),
                t.Status.ToString(), t.Source, t.CreatedAt, t.Resolution))
            .ToListAsync();

        return Results.Ok(tickets);
    }
}

public record MetricsOverview(
    int TotalTickets,
    int AutoResolved,
    int Escalated,
    double ResolutionRate,
    Dictionary<string, int> ByCategory,
    Dictionary<string, int> BySeverity);

public record TicketSummary(
    Guid Id,
    string Title,
    string Category,
    string Severity,
    string Status,
    string Source,
    DateTime CreatedAt,
    string? Resolution);
