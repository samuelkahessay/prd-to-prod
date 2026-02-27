using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// --- Service Registrations ---
builder.Services.AddDbContext<TicketDbContext>(o => o.UseInMemoryDatabase("TicketDb"));
builder.Services.AddRazorPages();

var app = builder.Build();

// --- Endpoint Mappings ---
app.MapRazorPages();
app.MapTicketEndpoints();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", version = "1.0.0" }));

app.Run();

// Expose for WebApplicationFactory in tests
public partial class Program { }
