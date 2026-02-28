using TicketDeflection.Models;

namespace TicketDeflection.Data;

public static class SeedData
{
    public static void Initialize(TicketDbContext context)
    {
        if (context.KnowledgeArticles.Any())
            return;

        var articles = new[]
        {
            new KnowledgeArticle
            {
                Title = "Common Error Codes",
                Content = "Error 500 means internal server error. Error 404 means not found. Error 403 means forbidden access.",
                Tags = "error,500,404,server,http",
                Category = TicketCategory.Bug
            },
            new KnowledgeArticle
            {
                Title = "Crash Recovery Guide",
                Content = "If the application crashes, restart it using the service manager. Check logs in /var/log for details.",
                Tags = "crash,recovery,restart,logs",
                Category = TicketCategory.Bug
            },
            new KnowledgeArticle
            {
                Title = "How to Export Data",
                Content = "Navigate to Settings > Export and choose CSV or JSON format. Large exports may take several minutes.",
                Tags = "export,data,csv,json,settings",
                Category = TicketCategory.HowTo
            },
            new KnowledgeArticle
            {
                Title = "Getting Started Guide",
                Content = "Welcome! Create your account, verify your email, then explore the dashboard. Use the help button for tooltips.",
                Tags = "onboarding,start,setup,account,dashboard",
                Category = TicketCategory.HowTo
            },
            new KnowledgeArticle
            {
                Title = "How to Configure Notifications",
                Content = "Go to Profile > Notifications to enable or disable email and in-app alerts for events.",
                Tags = "notifications,email,alerts,settings,profile",
                Category = TicketCategory.HowTo
            },
            new KnowledgeArticle
            {
                Title = "Feature Request Process",
                Content = "Submit feature requests via our feedback portal. We review all requests quarterly and prioritise by vote count.",
                Tags = "feature,request,feedback,roadmap",
                Category = TicketCategory.FeatureRequest
            },
            new KnowledgeArticle
            {
                Title = "Planned Feature Roadmap",
                Content = "Upcoming features include dark mode, API v2, and bulk operations. Check our public roadmap for timelines.",
                Tags = "roadmap,feature,upcoming,api,dark-mode",
                Category = TicketCategory.FeatureRequest
            },
            new KnowledgeArticle
            {
                Title = "Password Reset Guide",
                Content = "Click 'Forgot Password' on the login page, enter your email, and follow the reset link sent to your inbox.",
                Tags = "password,reset,login,email,account,forgot",
                Category = TicketCategory.AccountIssue
            },
            new KnowledgeArticle
            {
                Title = "Billing FAQ",
                Content = "Subscriptions renew monthly on the same date. To cancel, go to Billing > Cancel Subscription. Refunds are available within 7 days.",
                Tags = "billing,subscription,cancel,refund,payment",
                Category = TicketCategory.AccountIssue
            },
            new KnowledgeArticle
            {
                Title = "Two-Factor Authentication Setup",
                Content = "Enable 2FA under Security settings. Use an authenticator app like Google Authenticator or Authy.",
                Tags = "2fa,security,authentication,totp,account",
                Category = TicketCategory.AccountIssue
            },
            new KnowledgeArticle
            {
                Title = "Service Status and Uptime",
                Content = "Check our status page at status.example.com for real-time information about outages and maintenance windows.",
                Tags = "status,uptime,outage,maintenance,service",
                Category = TicketCategory.Other
            },
            new KnowledgeArticle
            {
                Title = "Contact Support",
                Content = "Reach our support team via email at support@example.com or through the in-app chat widget, available 9–5 weekdays.",
                Tags = "support,contact,email,chat,help",
                Category = TicketCategory.Other
            }
        };

        context.KnowledgeArticles.AddRange(articles);
        context.SaveChanges();
    }
}
