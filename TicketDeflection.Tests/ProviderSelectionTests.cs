using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

public class ProviderSelectionTests
{
    [Fact]
    public void DefaultProvider_UsesSqlite()
    {
        // The default factory (no overrides) should use SQLite
        using var factory = new WebApplicationFactory<Program>();
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();

        Assert.True(context.Database.IsSqlite());
    }

    [Fact]
    public void SqlServerProvider_WithoutConnectionString_ThrowsOnStartup()
    {
        Assert.Throws<InvalidOperationException>(() =>
        {
            using var factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(b =>
                {
                    b.UseSetting("Database:Provider", "SqlServer");
                });
            // Force host startup
            using var client = factory.CreateClient();
        });
    }

    [Fact]
    public void UnknownProvider_ThrowsOnStartup()
    {
        Assert.Throws<InvalidOperationException>(() =>
        {
            using var factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(b =>
                {
                    b.UseSetting("Database:Provider", "SqlSrv");
                });
            using var client = factory.CreateClient();
        });
    }

    [Fact]
    public void GetDemoSeedEnabled_DefaultsFalseForSqlServer()
    {
        var configuration = new ConfigurationBuilder().Build();

        Assert.False(Program.GetDemoSeedEnabled(configuration, Program.SqlServerProvider));
    }

    [Fact]
    public void GetDemoSeedEnabled_DefaultsTrueForSqlite()
    {
        var configuration = new ConfigurationBuilder().Build();

        Assert.True(Program.GetDemoSeedEnabled(configuration, Program.SqliteProvider));
    }

    [Fact]
    public void GetDemoSeedEnabled_ExplicitOverrideWins()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["DemoSeed:Enabled"] = "true" })
            .Build();

        Assert.True(Program.GetDemoSeedEnabled(configuration, Program.SqlServerProvider));
    }

    [Fact]
    public void SqliteProvider_WithEmptyConnectionString_UsesDefaultPath()
    {
        // Before the fix, GetConnectionString("Sqlite") returned "" from appsettings,
        // and ?? only catches null, so "" was passed to UseSqlite — causing a startup crash.
        // After the fix, IsNullOrWhiteSpace catches "" and the fallback path is used.
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b =>
            {
                b.UseSetting("ConnectionStrings:Sqlite", "");
                b.UseEnvironment("Development");
            });
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();

        Assert.True(context.Database.IsSqlite());
        var connStr = context.Database.GetConnectionString();
        // Development fallback uses local relative path
        Assert.Contains("ticketdb.db", connStr);
    }
}
