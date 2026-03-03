using TicketDeflection.Data;

namespace TicketDeflection.Tests;

[Collection("EnvironmentVariableTests")]
public class TicketDbContextFactoryTests
{
    private static readonly object EnvironmentLock = new();

    [Fact]
    public void CreateDbContext_WithoutConnectionString_Throws()
    {
        lock (EnvironmentLock)
        {
            var original = Environment.GetEnvironmentVariable("ConnectionStrings__SqlServer");
            try
            {
                Environment.SetEnvironmentVariable("ConnectionStrings__SqlServer", null);

                var factory = new TicketDbContextFactory();
                var ex = Assert.Throws<InvalidOperationException>(
                    (Action)(() => factory.CreateDbContext(Array.Empty<string>())));

                Assert.Contains("ConnectionStrings__SqlServer", ex.Message);
            }
            finally
            {
                Environment.SetEnvironmentVariable("ConnectionStrings__SqlServer", original);
            }
        }
    }

    [Fact]
    public void CreateDbContext_WithConnectionString_ReturnsContext()
    {
        lock (EnvironmentLock)
        {
            var original = Environment.GetEnvironmentVariable("ConnectionStrings__SqlServer");
            try
            {
                // Set a dummy connection string (we won't actually connect)
                Environment.SetEnvironmentVariable(
                    "ConnectionStrings__SqlServer",
                    "Server=localhost;Database=test;User Id=sa;Password=Dummy_password123;TrustServerCertificate=True;");

                var factory = new TicketDbContextFactory();
                using var context = factory.CreateDbContext(Array.Empty<string>());

                Assert.NotNull(context);
            }
            finally
            {
                Environment.SetEnvironmentVariable("ConnectionStrings__SqlServer", original);
            }
        }
    }
}
