#nullable enable

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

/// <summary>
/// Shared factory configuration for integration tests with fake auth.
/// </summary>
public static class TestFactoryExtensions
{
    /// <summary>
    /// Creates a WebApplicationFactory with an isolated in-memory DB and fake authentication.
    /// Tests using this factory are automatically authenticated as "test-operator".
    /// </summary>
    public static WebApplicationFactory<Program> WithTestAuth(
        this WebApplicationFactory<Program> factory,
        string? dbName = null)
    {
        dbName ??= $"TestDb_{Guid.NewGuid()}";
        return factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                ReplaceDbWithInMemory(services, dbName);
                services.AddAuthentication(TestAuthHandler.SchemeName)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        TestAuthHandler.SchemeName, _ => { });
            }));
    }

    /// <summary>
    /// Removes all DbContext/EF Core registrations and replaces with InMemory.
    /// This avoids "multiple database providers" conflict with SQLite.
    /// </summary>
    public static void ReplaceDbWithInMemory(IServiceCollection services, string dbName)
    {
        RemoveDbRegistrations(services);

        services.AddDbContext<TicketDbContext>(o =>
            o.UseInMemoryDatabase(dbName));
    }

    public static void ReplaceDbWithSqlite(IServiceCollection services, string connectionString)
    {
        RemoveDbRegistrations(services);

        services.AddDbContext<TicketDbContext>(o =>
            o.UseSqlite(connectionString));
    }

    public static WebApplicationFactory<Program> WithTestAuthSqlite(
        this WebApplicationFactory<Program> factory,
        string connectionString)
    {
        return factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                ReplaceDbWithSqlite(services, connectionString);
                services.AddAuthentication(TestAuthHandler.SchemeName)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        TestAuthHandler.SchemeName, _ => { });
            }));
    }

    private static void RemoveDbRegistrations(IServiceCollection services)
    {
        // Remove all EF Core provider and DbContext registrations to prevent
        // "multiple database providers" error when both SQLite and InMemory are present
        var descriptorsToRemove = services
            .Where(d =>
                d.ServiceType == typeof(DbContextOptions<TicketDbContext>) ||
                d.ServiceType == typeof(DbContextOptions) ||
                d.ServiceType.FullName?.Contains("EntityFrameworkCore") == true)
            .ToList();
        foreach (var d in descriptorsToRemove)
            services.Remove(d);
    }
}
