using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Endpoints;
using TicketDeflection.Services;

var builder = WebApplication.CreateBuilder(args);

// --- Service Registrations ---
builder.Services.AddDbContext<TicketDbContext>(o => o.UseInMemoryDatabase("TicketDb"));
builder.Services.AddScoped<ClassificationService>();
builder.Services.AddScoped<MatchingService>();
builder.Services.AddScoped<PipelineService>();
builder.Services.AddRazorPages();

var app = builder.Build();

// Seed knowledge base on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
    SeedData.Initialize(context);
}

// --- Endpoint Mappings ---
app.MapPipelineEndpoints();
app.MapMetricsEndpoints();
app.MapRazorPages();
app.MapTicketEndpoints();
app.MapKnowledgeEndpoints();
app.MapClassifyEndpoints();
app.MapResolveEndpoints();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", version = "1.0.0" }));

app.Run();

// Expose for WebApplicationFactory in tests
public partial class Program { }
