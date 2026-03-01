using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TicketDeflection.Data;
using TicketDeflection.Models;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class MatchingServiceTests
{
    private static TicketDbContext CreateContext()
    {
        var opts = new DbContextOptionsBuilder<TicketDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TicketDbContext(opts);
    }

    private static MatchingService CreateService(double threshold = 0.3)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MatchingThreshold"] = threshold.ToString()
            })
            .Build();
        return new MatchingService(config);
    }

    private static void SeedPasswordArticle(TicketDbContext context)
    {
        context.KnowledgeArticles.Add(new KnowledgeArticle
        {
            Id = Guid.NewGuid(),
            Title = "Password Reset Guide",
            Content = "Click Forgot Password on the login page, enter your email, and follow the reset link sent to your inbox.",
            Tags = "password,reset,login,email,account",
            Category = TicketCategory.AccountIssue
        });
        context.SaveChanges();
    }

    [Fact]
    public void PasswordResetTicket_AgainstSeedData_AutoResolved()
    {
        using var context = CreateContext();
        SeedPasswordArticle(context);

        var ticket = new Ticket
        {
            Title = "I forgot my password",
            Description = "I cannot login and need to reset my password via email",
            Status = TicketStatus.New
        };

        var service = CreateService();
        service.ResolveTicket(ticket, context);

        Assert.Equal(TicketStatus.AutoResolved, ticket.Status);
        Assert.NotNull(ticket.Resolution);
        Assert.Contains("Password", ticket.Resolution);
    }

    [Fact]
    public void GibberishTicket_NoMatch_Escalated()
    {
        using var context = CreateContext();
        SeedPasswordArticle(context);

        var ticket = new Ticket
        {
            Title = "zxqvbnm asdfgh",
            Description = "qwerty uiop lkjhgfds",
            Status = TicketStatus.New
        };

        var service = CreateService();
        service.ResolveTicket(ticket, context);

        Assert.Equal(TicketStatus.Escalated, ticket.Status);
    }

    [Fact]
    public void EmptyKnowledgeBase_Escalated()
    {
        using var context = CreateContext();

        var ticket = new Ticket
        {
            Title = "Any ticket",
            Description = "Some description",
            Status = TicketStatus.New
        };

        var service = CreateService();
        service.ResolveTicket(ticket, context);

        Assert.Equal(TicketStatus.Escalated, ticket.Status);
    }

    [Fact]
    public void ShortTicket_ForgotPassword_AutoResolved()
    {
        // 2-word ticket whose both words appear in the article → coverage = 100%
        using var context = CreateContext();
        SeedPasswordArticle(context);

        var ticket = new Ticket
        {
            Title = "forgot password",
            Description = "",
            Status = TicketStatus.New
        };

        var service = CreateService();
        service.ResolveTicket(ticket, context);

        Assert.Equal(TicketStatus.AutoResolved, ticket.Status);
        Assert.NotNull(ticket.Resolution);
        Assert.Contains("Password", ticket.Resolution);
    }

    [Fact]
    public void ShortTicket_CantLogin_AutoResolved()
    {
        // "login" appears in both article content and tags → coverage ≥ 0.5
        using var context = CreateContext();
        SeedPasswordArticle(context);

        var ticket = new Ticket
        {
            Title = "can't login",
            Description = "",
            Status = TicketStatus.New
        };

        var service = CreateService();
        service.ResolveTicket(ticket, context);

        Assert.Equal(TicketStatus.AutoResolved, ticket.Status);
    }

    [Fact]
    public void LongTicket_ManyMatchingWords_AutoResolved()
    {
        // Long tickets still match correctly after the asymmetric change
        using var context = CreateContext();
        SeedPasswordArticle(context);

        var ticket = new Ticket
        {
            Title = "Need help with account login and password reset",
            Description = "I cannot access my account and need to reset my password via the email link",
            Status = TicketStatus.New
        };

        var service = CreateService();
        service.ResolveTicket(ticket, context);

        Assert.Equal(TicketStatus.AutoResolved, ticket.Status);
        Assert.Contains("Password", ticket.Resolution!);
    }
}
