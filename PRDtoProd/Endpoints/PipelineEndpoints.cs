using PRDtoProd.Data;
using PRDtoProd.DTOs;
using PRDtoProd.Services;

namespace PRDtoProd.Endpoints;

public static class PipelineEndpoints
{
    public static void MapPipelineEndpoints(this WebApplication app)
    {
        app.MapPost("/api/tickets/submit", SubmitTicket).RequireRateLimiting("PublicPost");
    }

    private static async Task<IResult> SubmitTicket(
        SubmitRequest request, TicketDbContext db, PipelineService pipeline)
    {
        var result = await pipeline.ProcessTicket(request.Title, request.Description, request.Source, db);

        var ticketResponse = result.Ticket.ToResponse();

        var response = new SubmitResponse(
            ticketResponse,
            new ClassificationDetails(result.Category, result.Severity),
            new MatchResult(result.MatchedArticleTitle, result.MatchScore),
            result.ActivityLogs
                .Select(l => new ActivityLogEntry(l.Action, l.Details, l.Timestamp))
                .ToList());

        return Results.Ok(response);
    }
}

public record SubmitRequest(string Title, string Description, string Source);
public record ClassificationDetails(string Category, string Severity);
public record MatchResult(string? ArticleTitle, double Score);
public record ActivityLogEntry(string Action, string Details, DateTime Timestamp);
public record SubmitResponse(
    TicketResponse Ticket,
    ClassificationDetails Classification,
    MatchResult Match,
    List<ActivityLogEntry> ActivityLogs);
