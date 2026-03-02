using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class AutonomyEndpoints
{
    public static void MapAutonomyEndpoints(this WebApplication app)
    {
        app.MapGet("/api/autonomy/decisions", GetDecisions);
        app.MapGet("/api/autonomy/queue",     GetQueue);
        app.MapGet("/api/autonomy/metrics",   GetMetrics);
    }

    private static IResult GetDecisions(AutonomyLedgerService ledger)
    {
        var events = ledger.GetAllEvents();
        return Results.Ok(new { events });
    }

    private static IResult GetQueue(AutonomyLedgerService ledger)
    {
        var queue = ledger.GetQueue();
        return Results.Ok(queue);
    }

    private static IResult GetMetrics(AutonomyLedgerService ledger)
    {
        var metrics = ledger.GetMetrics();
        return Results.Ok(metrics);
    }
}
