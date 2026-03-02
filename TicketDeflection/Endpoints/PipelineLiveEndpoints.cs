using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class PipelineLiveEndpoints
{
    public static void MapPipelineLiveEndpoints(this WebApplication app)
    {
        app.MapGet("/api/pipeline/live", GetLiveSnapshot);
    }

    private static async Task<IResult> GetLiveSnapshot(
        IGitHubPipelineSnapshotService pipeline,
        CancellationToken cancellationToken)
    {
        var snapshot = await pipeline.GetSnapshotAsync(cancellationToken);
        return Results.Ok(snapshot);
    }
}
