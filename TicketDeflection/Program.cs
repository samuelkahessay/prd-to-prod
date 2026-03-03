using System.Text.Json.Serialization;
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
builder.Services.AddDbContext<TicketDbContext>(o => o.UseInMemoryDatabase("TicketDb"));
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

var app = builder.Build();

// Seed knowledge base and auto-populate demo tickets on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
    SeedData.Initialize(context);

    if (app.Configuration.GetValue<bool>("DemoSeed:Enabled", true))
        ComplianceSeedData.Seed(context);

    if (app.Configuration.GetValue<bool>("DemoSeed:Enabled", true) && !context.Tickets.Any())
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
public partial class Program { }
