using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TicketDeflection.Data;

/// <summary>
/// Design-time factory used by EF Core tooling (dotnet ef migrations add, etc.).
/// Always targets SQL Server because that is the production migration target.
/// SQLite dev/demo uses EnsureCreated() and does not use migrations.
/// </summary>
public class TicketDbContextFactory : IDesignTimeDbContextFactory<TicketDbContext>
{
    public TicketDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__SqlServer");

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                "Set the ConnectionStrings__SqlServer environment variable to generate SQL Server migrations. " +
                "Example: export ConnectionStrings__SqlServer=\"Server=localhost;Database=TicketDeflection;User Id=sa;Password=Dummy_password123;TrustServerCertificate=True;\"");
        }

        var optionsBuilder = new DbContextOptionsBuilder<TicketDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new TicketDbContext(optionsBuilder.Options);
    }
}
