using Microsoft.Extensions.Configuration;
using PRDtoProd.Data;
using PRDtoProd.DTOs;
using PRDtoProd.Models;

namespace PRDtoProd.Services;

public class MatchingService
{
    private readonly double _threshold;

    public MatchingService(IConfiguration configuration)
    {
        _threshold = configuration.GetValue<double>("MatchingThreshold", 0.3);
    }

    public (double BestScore, KnowledgeArticle? BestArticle) ResolveTicket(Ticket ticket, TicketDbContext context)
    {
        var articles = context.KnowledgeArticles.ToList();

        var ticketTokens = Tokenize($"{ticket.Title} {ticket.Description}");

        double bestScore = 0;
        KnowledgeArticle? bestArticle = null;

        foreach (var article in articles)
        {
            var articleTokens = Tokenize($"{article.Content} {article.Tags}");
            // Asymmetric coverage: fraction of the ticket's terms found in the article.
            // This correctly scores short tickets whose words all appear in a rich article.
            var score = Coverage(ticketTokens, articleTokens);
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

        return (bestScore, bestArticle);
    }

    public IReadOnlyList<ArticleMatch> GetTopMatches(Ticket ticket, IEnumerable<KnowledgeArticle> articles, int topN = 3)
    {
        var ticketTokens = Tokenize($"{ticket.Title} {ticket.Description}");
        return articles
            .Select(a => new ArticleMatch(
                a.Id, a.Title,
                Jaccard(ticketTokens, Tokenize($"{a.Content} {a.Tags}"))))
            .Where(m => m.Score > 0)
            .OrderByDescending(m => m.Score)
            .Take(topN)
            .ToList();
    }

    private static double Jaccard(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count == 0 && b.Count == 0) return 0;
        var intersection = a.Intersect(b).Count();
        var union = a.Union(b).Count();
        return intersection / (double)union;
    }

    private static readonly char[] _punctuation =
        ['.', '!', '?', ';', ':', '\'', '"', '(', ')', '[', ']', '{', '}', '<', '>', '/'];

    private static HashSet<string> Tokenize(string text) =>
        text.Split([' ', '\t', ',', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.Trim(_punctuation).ToLowerInvariant())
            .Where(t => t.Length > 0)
            .ToHashSet();

    // Returns the fraction of ticket tokens (a) that are present in the article tokens (b).
    private static double Coverage(HashSet<string> ticketTokens, HashSet<string> articleTokens)
    {
        if (ticketTokens.Count == 0) return 0;
        var matched = ticketTokens.Intersect(articleTokens).Count();
        return matched / (double)ticketTokens.Count;
    }
}
