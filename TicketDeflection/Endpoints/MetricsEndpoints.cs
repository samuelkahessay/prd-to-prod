using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Endpoints;

public static class MetricsEndpoints
{
    public static void MapMetricsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/metrics/overview", GetOverview);
    }

    private static IResult GetOverview(TicketDbContext db)
    {
        var tickets = db.Tickets.ToList();
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
}

public record MetricsOverview(
    int TotalTickets,
    int AutoResolved,
    int Escalated,
    double ResolutionRate,
    Dictionary<string, int> ByCategory,
    Dictionary<string, int> BySeverity);
