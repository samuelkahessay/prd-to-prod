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

        // Stage 3: Find best match score before resolving (for log entry)
        var articles = context.KnowledgeArticles.ToList();
        var ticketTokens = Tokenize($"{ticket.Title} {ticket.Description}");
        double bestScore = 0;
        KnowledgeArticle? bestArticle = null;
        foreach (var article in articles)
        {
            var articleTokens = Tokenize($"{article.Content} {article.Tags}");
            var score = Jaccard(ticketTokens, articleTokens);
            if (score > bestScore)
            {
                bestScore = score;
                bestArticle = article;
            }
        }

        _matcher.ResolveTicket(ticket, context);

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

    private static readonly char[] _punctuation =
        ['.', '!', '?', ';', ':', '\'', '"', '(', ')', '[', ']', '{', '}', '<', '>', '/'];

    private static HashSet<string> Tokenize(string text) =>
        text.Split([' ', '\t', ',', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.Trim(_punctuation).ToLowerInvariant())
            .Where(t => t.Length > 0)
            .ToHashSet();

    private static double Jaccard(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count == 0 && b.Count == 0) return 0;
        var intersection = a.Intersect(b).Count();
        var union = a.Union(b).Count();
        return intersection / (double)union;
    }
}
