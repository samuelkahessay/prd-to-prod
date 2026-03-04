# Azure SQL Migration Readiness — Implementation Plan

**Goal:** Make the app provider-configurable (SQLite for dev/demo, Azure SQL for production) with hardened schema, real EF migrations authored against SQL Server, and design-time factory for migration tooling.

**Architecture:** Single `TicketDbContext` with `OnModelCreating` defining the full schema. Provider selected at startup via `Database:Provider` config. SQL Server uses EF migrations (`Migrate()`); SQLite uses `SqliteDatabaseInitializer` (`EnsureCreated()` + compatibility fixes). A design-time factory ensures `dotnet ef` always targets SQL Server.

**Tech Stack:** .NET 10, EF Core 10.0.3, Microsoft.EntityFrameworkCore.SqlServer, xUnit

**Design doc:** `docs/plans/2026-03-03-azure-sql-migration-design.md`

---

### Task 1: Add SqlServer NuGet Package

**Files:**
- Modify: `TicketDeflection/TicketDeflection.csproj:9-12`

**Step 1: Add the SqlServer package**

In `TicketDeflection/TicketDeflection.csproj`, add the SqlServer package alongside the existing Sqlite and InMemory packages. Also add the Design package (needed for migration tooling).

The `<ItemGroup>` at lines 9-12 currently has:
```xml
<ItemGroup>
  <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.0.3" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.3" />
</ItemGroup>
```

Change it to:
```xml
<ItemGroup>
  <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.3">
    <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    <PrivateAssets>all</PrivateAssets>
  </PackageReference>
  <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.0.3" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.3" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.3" />
</ItemGroup>
```

**Step 2: Restore packages**

Run: `dotnet restore TicketDeflection/TicketDeflection.csproj`
Expected: `Restore completed` with no errors

**Step 3: Verify build**

Run: `dotnet build TicketDeflection/TicketDeflection.csproj --no-restore`
Expected: `Build succeeded` with 0 errors

**Step 4: Commit**

```bash
git add TicketDeflection/TicketDeflection.csproj
git commit -m "$(cat <<'EOF'
chore: add EF Core SqlServer and Design packages

Adds Microsoft.EntityFrameworkCore.SqlServer for Azure SQL provider
support and Microsoft.EntityFrameworkCore.Design for migration tooling.
Both at 10.0.3 to match existing EF Core packages.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Harden Schema in OnModelCreating

**Files:**
- Modify: `TicketDeflection/Data/TicketDbContext.cs:17-36`
- Test: `TicketDeflection.Tests/TicketDbContextTests.cs` (existing tests verify basic CRUD still works)

**Step 1: Write a failing test for ActivityLog FK enforcement**

Create a new test in `TicketDeflection.Tests/SchemaHardeningTests.cs`:

```csharp
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Tests;

public class SchemaHardeningTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly TicketDbContext _context;

    public SchemaHardeningTests()
    {
        // Use real SQLite so FK constraints are enforced
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        // Enable FK enforcement (SQLite disables by default)
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys = ON;";
        cmd.ExecuteNonQuery();

        var options = new DbContextOptionsBuilder<TicketDbContext>()
            .UseSqlite(_connection)
            .Options;
        _context = new TicketDbContext(options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task ActivityLog_RequiresValidTicketId()
    {
        var orphanLog = new ActivityLog
        {
            TicketId = Guid.NewGuid(), // non-existent ticket
            Action = "Classified",
            Details = "Should fail"
        };
        _context.ActivityLogs.Add(orphanLog);

        await Assert.ThrowsAsync<DbUpdateException>(
            () => _context.SaveChangesAsync());
    }

    [Fact]
    public async Task ActivityLog_CascadeDeletesWithTicket()
    {
        var ticket = new Ticket
        {
            Title = "Test",
            Description = "Test",
            Source = "test"
        };
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        _context.ActivityLogs.Add(new ActivityLog
        {
            TicketId = ticket.Id,
            Action = "Classified",
            Details = "Bug"
        });
        await _context.SaveChangesAsync();

        _context.Tickets.Remove(ticket);
        await _context.SaveChangesAsync();

        var logCount = await _context.ActivityLogs.CountAsync();
        Assert.Equal(0, logCount);
    }

    [Fact]
    public async Task ComplianceDecision_RestrictDeleteOfScanWithDecision()
    {
        var scan = new ComplianceScan
        {
            ContentType = ContentType.CODE,
            Disposition = ComplianceDisposition.HUMAN_REQUIRED
        };
        _context.ComplianceScans.Add(scan);
        await _context.SaveChangesAsync();

        _context.ComplianceDecisions.Add(new ComplianceDecision
        {
            ScanId = scan.Id,
            OperatorId = "test-operator",
            Decision = ComplianceDecisionType.Approved
        });
        await _context.SaveChangesAsync();

        _context.ComplianceScans.Remove(scan);
        await Assert.ThrowsAsync<DbUpdateException>(
            () => _context.SaveChangesAsync());
    }

    [Fact]
    public async Task ComplianceFinding_CascadeDeletesWithScan()
    {
        var scan = new ComplianceScan
        {
            ContentType = ContentType.CODE,
            Disposition = ComplianceDisposition.ADVISORY
        };
        _context.ComplianceScans.Add(scan);
        await _context.SaveChangesAsync();

        _context.ComplianceFindings.Add(new ComplianceFinding
        {
            ScanId = scan.Id,
            Regulation = ComplianceRegulation.PIPEDA,
            RuleId = "TEST-001",
            RuleName = "Test Rule",
            Citation = "Test",
            Category = "test",
            Severity = FindingSeverity.Low,
            Disposition = ComplianceDisposition.ADVISORY
        });
        await _context.SaveChangesAsync();

        _context.ComplianceScans.Remove(scan);
        await _context.SaveChangesAsync();

        var findingCount = await _context.ComplianceFindings.CountAsync();
        Assert.Equal(0, findingCount);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `dotnet test TicketDeflection.Tests/ --filter "FullyQualifiedName~SchemaHardeningTests" --no-build 2>&1 || true`

Then build and run:
Run: `dotnet test TicketDeflection.Tests/ --filter "FullyQualifiedName~SchemaHardeningTests"`

Expected:
- `ActivityLog_RequiresValidTicketId` FAILS because the ActivityLog FK is not defined yet
- `ActivityLog_CascadeDeletesWithTicket` FAILS because there is no ActivityLog FK/cascade path yet
- `ComplianceDecision_RestrictDeleteOfScanWithDecision` FAILS because the current relationship is not explicitly `Restrict`
- `ComplianceFinding_CascadeDeletesWithScan` may already PASS by convention, but keep the explicit delete behavior in code for clarity and provider consistency

**Step 3: Implement schema hardening**

In `TicketDeflection/Data/TicketDbContext.cs`, replace the `OnModelCreating` method (lines 17-36) with:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // ActivityLog → Ticket (missing FK — added for schema hardening)
    modelBuilder.Entity<ActivityLog>()
        .HasOne<Ticket>()
        .WithMany()
        .HasForeignKey(a => a.TicketId)
        .OnDelete(DeleteBehavior.Cascade);

    // ComplianceFinding → ComplianceScan
    modelBuilder.Entity<ComplianceFinding>()
        .HasOne(f => f.Scan)
        .WithMany(s => s.Findings)
        .HasForeignKey(f => f.ScanId)
        .OnDelete(DeleteBehavior.Cascade);

    // ComplianceDecision → ComplianceScan (Restrict: protect audit trail)
    modelBuilder.Entity<ComplianceDecision>()
        .HasOne(d => d.Scan)
        .WithMany()
        .HasForeignKey(d => d.ScanId)
        .OnDelete(DeleteBehavior.Restrict);

    modelBuilder.Entity<ComplianceDecision>()
        .Property(d => d.Decision)
        .HasConversion<string>();

    modelBuilder.Entity<ComplianceDecision>()
        .HasIndex(d => d.ScanId)
        .IsUnique();
}
```

**Step 4: Run all schema tests**

Run: `dotnet test TicketDeflection.Tests/ --filter "FullyQualifiedName~SchemaHardeningTests"`
Expected: All 4 tests PASS

**Step 5: Run full test suite to check for regressions**

Run: `dotnet test TicketDeflection.Tests/`
Expected: All existing tests PASS. The InMemory provider doesn't enforce FKs, so existing tests that create ActivityLogs with random TicketIds will still pass.

**Step 6: Commit**

```bash
git add TicketDeflection/Data/TicketDbContext.cs TicketDeflection.Tests/SchemaHardeningTests.cs
git commit -m "$(cat <<'EOF'
feat(schema): add ActivityLog FK and explicit delete behaviors

Adds missing foreign key constraint on ActivityLog.TicketId → Ticket.Id
with cascade delete. Sets explicit delete behaviors:
- ComplianceFinding → ComplianceScan: Cascade
- ComplianceDecision → ComplianceScan: Restrict (protect audit trail)
- ActivityLog → Ticket: Cascade

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add Provider Configuration to Program.cs and appsettings

**Files:**
- Modify: `TicketDeflection/Program.cs:18-22` (service registrations) and lines 76-86 (startup init)
- Modify: `TicketDeflection/appsettings.json`
- Modify: `TicketDeflection/appsettings.Development.json`

**Step 1: Write a failing test for provider selection**

Create `TicketDeflection.Tests/ProviderSelectionTests.cs`:

```csharp
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
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
}
```

**Step 2: Run to see them fail**

Run: `dotnet test TicketDeflection.Tests/ --filter "FullyQualifiedName~ProviderSelectionTests"`
Expected: Both tests FAIL — the current `Program.cs` doesn't read `Database:Provider` config.

**Step 3: Update appsettings.json**

Replace the full content of `TicketDeflection/appsettings.json` with:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "MatchingThreshold": 0.15,
  "OperatorAuth": {
    "Passphrase": ""
  },
  "Database": {
    "Provider": "Sqlite"
  },
  "ConnectionStrings": {
    "Sqlite": "",
    "SqlServer": ""
  }
}
```

**Step 4: Update appsettings.Development.json**

Replace the full content of `TicketDeflection/appsettings.Development.json` with:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "OperatorAuth": {
    "Passphrase": "operator-dev-passphrase"
  },
  "ComplianceScanner": {
    "AllowDemoBypass": true
  },
  "ConnectionStrings": {
    "Sqlite": "Data Source=ticketdb.db"
  }
}
```

**Step 5: Update Program.cs — provider-conditional registration**

In `TicketDeflection/Program.cs`, replace lines 18-22:

```csharp
// --- Service Registrations ---
var connectionString = builder.Environment.IsDevelopment()
    ? "Data Source=ticketdb.db"
    : "Data Source=/home/data/ticketdb.db";
builder.Services.AddDbContext<TicketDbContext>(o => o.UseSqlite(connectionString));
```

With:

```csharp
// --- Service Registrations ---
var dbProvider = builder.Configuration["Database:Provider"] ?? "Sqlite";

if (string.Equals(dbProvider, "SqlServer", StringComparison.OrdinalIgnoreCase))
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
    var connStr = builder.Configuration.GetConnectionString("Sqlite")
        ?? (builder.Environment.IsDevelopment()
            ? "Data Source=ticketdb.db"
            : "Data Source=/home/data/ticketdb.db");
    builder.Services.AddDbContext<TicketDbContext>(o => o.UseSqlite(connStr));
}
```

**Step 6: Update Program.cs — provider-conditional startup initialization**

Also need to add `using Microsoft.EntityFrameworkCore;` if not already present (it is at line 5).

Replace lines 76-86 (the data directory creation and DB init block):

```csharp
// Ensure data directory exists for production SQLite path
if (!app.Environment.IsDevelopment())
{
    Directory.CreateDirectory("/home/data");
}

// Seed knowledge base and auto-populate demo tickets on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
    await SqliteDatabaseInitializer.EnsureCreatedAndApplyCompatibilityFixesAsync(context);
```

With:

```csharp
// Seed knowledge base and auto-populate demo tickets on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();

    if (string.Equals(dbProvider, "SqlServer", StringComparison.OrdinalIgnoreCase))
    {
        await context.Database.MigrateAsync();
    }
    else
    {
        // Ensure data directory exists for production SQLite path
        if (!app.Environment.IsDevelopment())
            Directory.CreateDirectory("/home/data");

        await SqliteDatabaseInitializer.EnsureCreatedAndApplyCompatibilityFixesAsync(context);
    }
```

Note: the rest of the startup block (seed data, demo tickets) stays exactly the same. Only the DB initialization changes.

**Step 7: Run provider selection tests**

Run: `dotnet test TicketDeflection.Tests/ --filter "FullyQualifiedName~ProviderSelectionTests"`
Expected: Both tests PASS

**Step 8: Run full test suite**

Run: `dotnet test TicketDeflection.Tests/`
Expected: All tests PASS (existing tests use `WithTestAuth()` which replaces the DB with InMemory, so the provider selection in `Program.cs` is overridden in tests)

**Step 9: Commit**

```bash
git add TicketDeflection/Program.cs TicketDeflection/appsettings.json TicketDeflection/appsettings.Development.json TicketDeflection.Tests/ProviderSelectionTests.cs
git commit -m "$(cat <<'EOF'
feat(db): add provider-configurable DbContext (SQLite/SqlServer)

Provider selected via Database:Provider config (default: Sqlite).
SqlServer path uses Migrate(); SQLite path uses the existing
SqliteDatabaseInitializer. Connection strings are named per-provider.
Missing SqlServer connection string throws at startup.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create Design-Time DbContext Factory

**Files:**
- Create: `TicketDeflection/Data/TicketDbContextFactory.cs`
- Create: `TicketDeflection.Tests/TicketDbContextFactoryTests.cs`

**Step 1: Write a test for the factory**

Create `TicketDeflection.Tests/TicketDbContextFactoryTests.cs`:

```csharp
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
                    () => factory.CreateDbContext(Array.Empty<string>()));

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
```

Also add `TicketDeflection.Tests/EnvironmentVariableCollection.cs`:

```csharp
using Xunit;

namespace TicketDeflection.Tests;

[CollectionDefinition("EnvironmentVariableTests", DisableParallelization = true)]
public sealed class EnvironmentVariableCollection
{
}
```

**Step 2: Run to see it fail**

Run: `dotnet test TicketDeflection.Tests/ --filter "FullyQualifiedName~TicketDbContextFactoryTests"`
Expected: FAIL — `TicketDbContextFactory` and the environment-variable collection helper do not exist yet

**Step 3: Create the factory**

Create `TicketDeflection/Data/TicketDbContextFactory.cs`:

```csharp
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
```

This is intentionally narrower than the design doc's "env var or local developer secret" wording. For initial readiness, env-var-only is the safer, more deterministic design-time path. User-secrets support can be layered in later without changing the migration model.

**Step 4: Run factory tests**

Run: `dotnet test TicketDeflection.Tests/ --filter "FullyQualifiedName~TicketDbContextFactoryTests"`
Expected: Both tests PASS

**Step 5: Run full test suite**

Run: `dotnet test TicketDeflection.Tests/`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add TicketDeflection/Data/TicketDbContextFactory.cs TicketDeflection.Tests/TicketDbContextFactoryTests.cs TicketDeflection.Tests/EnvironmentVariableCollection.cs
git commit -m "$(cat <<'EOF'
feat(db): add design-time SQL Server factory for EF migrations

TicketDbContextFactory implements IDesignTimeDbContextFactory and
always targets SQL Server via ConnectionStrings__SqlServer env var.
Adds test isolation for env-var mutation and fails fast with a clear
message when the connection string is missing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Generate Initial SQL Server Migration

**Files:**
- Create: `TicketDeflection/Migrations/` (auto-generated by EF tooling)

**Step 1: Install EF Core CLI tools if needed**

Run: `dotnet tool list -g | grep dotnet-ef || dotnet tool install --global dotnet-ef --version 10.0.3`
Expected: `dotnet-ef` listed at `10.0.3` or installed at `10.0.3`

**Step 2: Generate the migration**

This requires a SQL Server connection string. Since we don't have a live SQL Server, we'll use a dummy connection string — EF Core generates migrations from the model, not from a live database.

Run:
```bash
ConnectionStrings__SqlServer="Server=localhost;Database=TicketDeflection;User Id=sa;Password=Dummy_password123;TrustServerCertificate=True;" \
  dotnet ef migrations add InitialCreate \
  --project TicketDeflection \
  --startup-project TicketDeflection
```

Expected: Migration files created in `TicketDeflection/Migrations/`:
- `<timestamp>_InitialCreate.cs` — the migration
- `<timestamp>_InitialCreate.Designer.cs` — snapshot metadata
- `TicketDbContextModelSnapshot.cs` — current model snapshot

**Step 3: Inspect the generated migration**

Read the `<timestamp>_InitialCreate.cs` file. Verify it contains:
- `CREATE TABLE` for all 6 entities
- FK constraint on `ActivityLog.TicketId` → `Ticket.Id` with `ON DELETE CASCADE`
- FK constraint on `ComplianceFinding.ScanId` → `ComplianceScan.Id` with `ON DELETE CASCADE`
- FK constraint on `ComplianceDecision.ScanId` → `ComplianceScan.Id` with `ON DELETE NO ACTION` (Restrict)
- Unique index `IX_ComplianceDecisions_ScanId`
- Decision column stored as `nvarchar` (string conversion)

**Step 4: Build to verify migration compiles**

Run: `dotnet build TicketDeflection/`
Expected: `Build succeeded`

**Step 5: Run full test suite**

Run: `dotnet test TicketDeflection.Tests/`
Expected: All tests PASS (migrations don't affect InMemory test runner)

**Step 6: Commit**

```bash
git add TicketDeflection/Migrations/
git commit -m "$(cat <<'EOF'
feat(db): add InitialCreate SQL Server migration

Auto-generated EF Core migration capturing the full schema:
6 entities, FK constraints (including new ActivityLog.TicketId),
explicit delete behaviors, unique index on ComplianceDecision.ScanId.
Authored against SQL Server as the production target.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verify Local Dev Still Works End-to-End

**Files:** None (verification only)

**Step 1: Delete local SQLite DB to test fresh creation**

Run: `rm -f TicketDeflection/ticketdb.db`

**Step 2: Run the app locally**

Run: `cd TicketDeflection && dotnet run --urls http://localhost:5123 &`
Wait 5 seconds, then:
Run: `curl -s http://localhost:5123/health | python3 -m json.tool`
Expected: `{"status": "healthy", "version": "1.0.0"}`

**Step 3: Verify DB was created and seeded**

Run: `curl -s http://localhost:5123/api/tickets | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'{len(data)} tickets')"`
Expected: `25 tickets` (demo seed)

Run: `curl -s http://localhost:5123/api/scans | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'{len(data)} scans')"`
Expected: `5 scans` (compliance seed)

**Step 4: Stop the app**

Run: `kill %1 2>/dev/null || true`

**Step 5: Run full test suite one more time**

Run: `dotnet test TicketDeflection.Tests/`
Expected: All tests PASS

**Step 6: No commit needed — this is verification only**

---

### Task 7: Final Full-Suite Verification and Summary Commit

**Files:** None new

**Step 1: Run complete test suite**

Run: `dotnet test TicketDeflection.Tests/ --verbosity normal`
Expected: All tests PASS, 0 failures

**Step 2: Verify git status is clean**

Run: `git status`
Expected: No unexpected modified files. Pre-existing unrelated untracked files may still be present.

**Step 3: Review commit log**

Run: `git log --oneline -6`
Expected: 5 new commits from this plan (packages, schema, provider config, factory, migration) plus the design doc commit.
