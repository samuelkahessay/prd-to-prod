using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Endpoints;
using TicketDeflection.Services;

var builder = WebApplication.CreateBuilder(args);

// Enable string-based enum serialization so JSON like "CODE" or "AUTO_BLOCK" works
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// --- Service Registrations ---
var dbProvider = Program.GetDatabaseProvider(builder.Configuration);

if (Program.IsSqlServerProvider(dbProvider))
{
    var connStr = builder.Configuration.GetConnectionString("SqlServer");
    if (string.IsNullOrWhiteSpace(connStr))
    {
        throw new InvalidOperationException(
            "Database:Provider is set to SqlServer but ConnectionStrings:SqlServer is not configured.");
    }
    builder.Services.AddDbContext<TicketDbContext>(o => o.UseSqlServer(connStr));
}
else
{
    var connStr = builder.Configuration.GetConnectionString("Sqlite");
    if (string.IsNullOrWhiteSpace(connStr))
    {
        connStr = builder.Environment.IsDevelopment()
            ? "Data Source=ticketdb.db"
            : "Data Source=/home/data/ticketdb.db";
    }
    builder.Services.AddDbContext<TicketDbContext>(o => o.UseSqlite(connStr));
}
builder.Services.AddScoped<ClassificationService>();
builder.Services.AddScoped<MatchingService>();
builder.Services.AddScoped<PipelineService>();
builder.Services.AddSingleton<IDecisionLedgerService, DecisionLedgerService>();
builder.Services.AddSingleton<IDrillReportService, DrillReportService>();
builder.Services.AddSingleton<IShowcaseService, ShowcaseService>();
builder.Services.AddSingleton<IComplianceRuleLibrary, ComplianceRuleLibrary>();
builder.Services.AddScoped<IComplianceScanService, ComplianceScanService>();
builder.Services.AddHttpClient<IGitHubPipelineSnapshotService, GitHubPipelineSnapshotService>();
builder.Services.AddRazorPages();

// --- Authentication & Authorization ---
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/operator/login";
        options.Cookie.Name = "OperatorAuth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                // API endpoints get 401, not 302 redirect
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                }
                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// --- Rate Limiting ---
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("PublicPost", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var app = builder.Build();
var enableDemoSeed = Program.GetDemoSeedEnabled(app.Configuration, dbProvider);

// Seed knowledge base and auto-populate demo tickets on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();

    if (Program.IsSqlServerProvider(dbProvider))
    {
        await context.Database.MigrateAsync();
    }
    else
    {
        // Ensure data directory exists for production SQLite path
        if (!app.Environment.IsDevelopment())
        {
            try { Directory.CreateDirectory("/home/data"); }
            catch (IOException) { /* running outside container (e.g. macOS) */ }
        }

        await SqliteDatabaseInitializer.EnsureCreatedAndApplyCompatibilityFixesAsync(context);
    }
    SeedData.Initialize(context);

    if (enableDemoSeed)
        ComplianceSeedData.Seed(context);

    if (enableDemoSeed && !context.Tickets.Any())
    {
        var pipeline = scope.ServiceProvider.GetRequiredService<PipelineService>();
        var random = new Random(42);
        for (var i = 0; i < 25; i++)
        {
            var template = SimulateEndpoints.SampleTickets[random.Next(SimulateEndpoints.SampleTickets.Length)];
            await pipeline.ProcessTicket(template.Title, template.Description, template.Source, context);
        }
    }
}

app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// --- Endpoint Mappings ---
app.MapPipelineEndpoints();
app.MapPipelineLiveEndpoints();
app.MapSimulateEndpoints();
app.MapAutonomyEndpoints();
app.MapMetricsEndpoints();
app.MapShowcaseEndpoints();
app.MapRazorPages();
app.MapTicketEndpoints();
app.MapKnowledgeEndpoints();
app.MapClassifyEndpoints();
app.MapResolveEndpoints();
app.MapComplianceEndpoints();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", version = "1.0.0" }));

app.Run();

// Expose for WebApplicationFactory in tests
public partial class Program
{
    internal const string SqliteProvider = "Sqlite";
    internal const string SqlServerProvider = "SqlServer";

    internal static string GetDatabaseProvider(IConfiguration configuration)
    {
        var configuredProvider = configuration["Database:Provider"];
        if (string.IsNullOrWhiteSpace(configuredProvider))
            return SqliteProvider;

        var normalizedProvider = configuredProvider.Trim();

        if (string.Equals(normalizedProvider, SqliteProvider, StringComparison.OrdinalIgnoreCase))
            return SqliteProvider;

        if (string.Equals(normalizedProvider, SqlServerProvider, StringComparison.OrdinalIgnoreCase))
            return SqlServerProvider;

        throw new InvalidOperationException(
            $"Unsupported Database:Provider value '{configuredProvider}'. Supported values are '{SqliteProvider}' and '{SqlServerProvider}'.");
    }

    internal static bool IsSqlServerProvider(string databaseProvider) =>
        string.Equals(databaseProvider, SqlServerProvider, StringComparison.OrdinalIgnoreCase);

    internal static bool GetDemoSeedEnabled(IConfiguration configuration, string databaseProvider) =>
        configuration.GetValue<bool?>("DemoSeed:Enabled")
        ?? !IsSqlServerProvider(databaseProvider);
}
