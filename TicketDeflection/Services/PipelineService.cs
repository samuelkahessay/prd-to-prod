using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Services;

public record PipelineResult(
    Ticket Ticket,
    string Category,
    string Severity,
    string? MatchedArticleTitle,
    double MatchScore,
    List<ActivityLog> ActivityLogs);

public class PipelineService
{
    private readonly ClassificationService _classifier;
    private readonly MatchingService _matcher;

    public PipelineService(ClassificationService classifier, MatchingService matcher)
    {
        _classifier = classifier;
        _matcher = matcher;
    }

    public async Task<PipelineResult> ProcessTicket(
        string title, string description, string source, TicketDbContext context)
    {
        var ticket = new Ticket
        {
            Title = title,
            Description = description,
            Source = source,
            Status = TicketStatus.New
        };

        var logs = new List<ActivityLog>();

        // Stage 1: Create ticket
        context.Tickets.Add(ticket);
        logs.Add(CreateLog(ticket.Id, "Ticket Created", $"Source: {source}"));

        // Stage 2: Classify
        _classifier.ClassifyTicket(ticket);
        logs.Add(CreateLog(ticket.Id, $"Ticket Classified as {ticket.Category}/{ticket.Severity}", ""));

        // Stage 3: Match and resolve — use the score from MatchingService (single source of truth)
        var (bestScore, bestArticle) = _matcher.ResolveTicket(ticket, context);

        if (ticket.Status == TicketStatus.AutoResolved)
        {
            logs.Add(CreateLog(ticket.Id, $"Ticket Matched (score: {bestScore:F2})", $"Article: {bestArticle?.Title}"));
            logs.Add(CreateLog(ticket.Id, $"Ticket Auto-Resolved: {bestArticle?.Title}", ticket.Resolution ?? ""));
        }
        else
        {
            logs.Add(CreateLog(ticket.Id, "Ticket Escalated (no match above threshold)", ""));
            logs.Add(CreateLog(ticket.Id, "Ticket Escalated: no matching articles", ""));
        }

        context.ActivityLogs.AddRange(logs);
        await context.SaveChangesAsync();

        return new PipelineResult(ticket, ticket.Category.ToString(), ticket.Severity.ToString(),
            bestArticle?.Title, bestScore, logs);
    }

    private static ActivityLog CreateLog(Guid ticketId, string action, string details) => new()
    {
        TicketId = ticketId,
        Action = action,
        Details = details
    };
}
