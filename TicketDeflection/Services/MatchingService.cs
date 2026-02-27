using Microsoft.Extensions.Configuration;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Services;

public class MatchingService
{
    private readonly double _threshold;

    public MatchingService(IConfiguration configuration)
    {
        _threshold = configuration.GetValue<double>("MatchingThreshold", 0.3);
    }

    public void ResolveTicket(Ticket ticket, TicketDbContext context)
    {
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

        if (bestScore >= _threshold && bestArticle is not null)
        {
            ticket.Status = TicketStatus.AutoResolved;
            var snippet = bestArticle.Content.Length > 150
                ? bestArticle.Content[..150] + "..."
                : bestArticle.Content;
            ticket.Resolution = $"{bestArticle.Title}: {snippet}";
        }
        else
        {
            ticket.Status = TicketStatus.Escalated;
        }
    }

    private static HashSet<string> Tokenize(string text) =>
        text.Split([' ', '\t', ',', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.ToLowerInvariant())
            .ToHashSet();

    private static double Jaccard(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count == 0 && b.Count == 0) return 0;
        var intersection = a.Intersect(b).Count();
        var union = a.Union(b).Count();
        return intersection / (double)union;
    }
}
