using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class AutonomyEndpoints
{
    public static void MapAutonomyEndpoints(this WebApplication app)
    {
        app.MapGet("/api/autonomy/decisions", GetDecisions);
        app.MapGet("/api/autonomy/queue", GetQueue);
        app.MapGet("/api/autonomy/metrics", GetMetrics);
    }

    private static async Task<IResult> GetDecisions(IDecisionLedgerService ledger)
    {
        var decisions = await ledger.GetDecisionsAsync();
        return Results.Ok(decisions);
    }

    private static async Task<IResult> GetQueue(IDecisionLedgerService ledger)
    {
        var queue = await ledger.GetQueueAsync();
        return Results.Ok(queue);
    }

    private static async Task<IResult> GetMetrics(IDecisionLedgerService ledger)
    {
        var metrics = await ledger.GetMetricsAsync();
        return Results.Ok(metrics);
    }
}
