# Azure SQL Migration Design

**Date:** 2026-03-03
**Status:** Phase 1 — code changes only, no live cutover

## Problem

The app uses SQLite at `/home/data/ticketdb.db` on Azure App Service. This works but is structurally weak:

- SQLite on App Service mounts is durable across restarts but not across scale-out, slot swaps, or platform migrations.
- Schema changes require dropping and recreating the DB (`EnsureCreated()` cannot evolve schemas).
- The `ActivityLog.TicketId` column has no foreign key constraint — orphaned logs are possible.
- "SQLite on `/home`" is a weak answer for durable, enforceable compliance state.

## Target State

- **Production provider:** Azure SQL (managed, in `prd-to-prod-rg`)
- **Dev/demo provider:** SQLite (local, zero-config)
- **Schema management:** EF Core migrations authored against SQL Server
- **SQLite dev path:** continues to use `SqliteDatabaseInitializer.EnsureCreatedAndApplyCompatibilityFixesAsync(...)` to preserve the current compatibility-fix path for existing SQLite databases

## Design Decisions

### 1. Provider Configuration

Both providers get their own named connection string. No hidden path logic.

```csharp
var provider = builder.Configuration["Database:Provider"] ?? "Sqlite";

if (string.Equals(provider, "SqlServer", StringComparison.OrdinalIgnoreCase))
{
    var connStr = builder.Configuration.GetConnectionString("SqlServer")
        ?? throw new InvalidOperationException("Missing SqlServer connection string.");
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

Config shape:

```json
{
  "Database": { "Provider": "Sqlite" },
  "ConnectionStrings": {
    "Sqlite": "",
    "SqlServer": ""
  }
}
```

In Azure App Settings, set `Database__Provider=SqlServer` and `ConnectionStrings__SqlServer=Server=tcp:...` to flip providers with no code deploy.

### 2. Schema Hardening

In `OnModelCreating`:

**Add missing FK:**
```csharp
modelBuilder.Entity<ActivityLog>()
    .HasOne<Ticket>()
    .WithMany()
    .HasForeignKey(a => a.TicketId)
    .OnDelete(DeleteBehavior.Cascade);
```

**Explicit delete behaviors:**
- `ComplianceFinding` → `ComplianceScan`: `Cascade` (findings are meaningless without their scan)
- `ComplianceDecision` → `ComplianceScan`: `Restrict` (prevent deleting a scan that has a human decision recorded — this is the audit trail)
- `ActivityLog` → `Ticket`: `Cascade` (logs are subordinate to their ticket)

**Preserved constraints:**
- Unique index on `ComplianceDecision.ScanId` (one decision per scan)
- Enum-to-string conversion on `ComplianceDecision.Decision`
- All existing FK relationships

### 3. Migration Strategy

**Migrations are authored against SQL Server** because that is the production target.

- Add a dedicated design-time factory for migrations:
  - `TicketDeflection/Data/TicketDbContextFactory.cs`
  - Implements `IDesignTimeDbContextFactory<TicketDbContext>`
  - Always creates the context with `UseSqlServer(...)`
  - Reads the connection string from `ConnectionStrings__SqlServer` or a local developer secret
  - Throws immediately if no SQL Server connection string is configured
- Use `dotnet ef migrations add InitialCreate` through that design-time factory
- The migration captures the full schema: all 6 entities, FKs, unique constraints, delete behaviors
- SQLite dev/demo path does **not** use these migrations — it continues using `SqliteDatabaseInitializer.EnsureCreatedAndApplyCompatibilityFixesAsync(...)`, which reads the same `OnModelCreating` configuration and applies compatibility fixes for existing SQLite files

**Startup path:**
```csharp
if (provider == "SqlServer")
    context.Database.Migrate(); // Apply pending migrations
else
    await SqliteDatabaseInitializer.EnsureCreatedAndApplyCompatibilityFixesAsync(context);
```

**Why not one migration set for both providers:**
EF Core migrations are provider-aware. SQL Server migrations generate T-SQL; SQLite migrations generate SQLite DDL. Cross-provider migration compatibility is not worth the complexity. The schema is defined once in `OnModelCreating`; each provider gets the right initialization path.

### 4. Transition Plan for Existing SQLite

**Local/dev:** Starts fresh if needed. Deleting `ticketdb.db` is still valid, but the default path preserves the current SQLite compatibility initializer:
- `EnsureCreated()` creates the DB if missing
- compatibility fixes normalize legacy decision values
- duplicate compliance decisions are removed
- the unique index on `ComplianceDecision.ScanId` is recreated if needed

This is safer than requiring developers to wipe local state just to pick up the hardening changes.

**Current Azure deployment (pre-cutover):** Continues running on SQLite at `/home/data/ticketdb.db`. The SQLite initializer preserves the current file-backed deployment and applies compatibility fixes to existing decision data. It still does **not** evolve SQLite schemas the way migrations do, so new relational hardening such as the `ActivityLog.TicketId` FK lands fully only when the production cutover creates a fresh Azure SQL schema via `Migrate()`.

**Phase 2 Azure cutover:** Azure SQL gets the full schema via `Migrate()`. Seed data populates the new DB. The old SQLite file becomes inert.

### 5. Fallback Plan (Not "Rollback")

Reverting `Database__Provider` to `Sqlite` and clearing the SQL Server connection string points the app back at the old SQLite store. This is a **fallback to stale data**, not a true rollback — any writes that landed in Azure SQL after cutover are not present in the SQLite file.

If a rollback is truly needed post-cutover:
1. Export data from Azure SQL
2. Import into a fresh SQLite file at `/home/data/ticketdb.db`
3. Revert the App Settings

This is an emergency procedure, not a routine operation.

### 6. NuGet Changes

Add to `TicketDeflection.csproj`:
```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.3" />
```

Existing packages stay:
- `Microsoft.EntityFrameworkCore.Sqlite` (for dev/demo)
- `Microsoft.EntityFrameworkCore.InMemory` (test project only)
- `Microsoft.EntityFrameworkCore.Design` (for migration tooling)

### 7. Test Changes

- Existing tests use `UseInMemoryDatabase` — unchanged
- Preserve and extend the current SQLite compatibility tests — they remain part of the startup contract until Azure SQL cutover
- Verify provider-selection logic: SQLite default, SqlServer when configured, missing connection string throws
- Add design-time factory coverage: verify migration tooling fails fast when `ConnectionStrings__SqlServer` is missing and builds a SQL Server context when it is present

**Deliberately not required in phase 1:** a live SQL Server migration smoke test. That would need a local SQL Server container, test database, or CI harness that this repo does not currently provide. The safer initial bar is deterministic design-time factory behavior plus provider-selection coverage.

### 8. What's Out of Scope

- **Azure SQL provisioning** — deferred to phase 2
- **Azure Storage** — not part of this change
- **DecisionLedgerService** — remains file-based (gh-aw integration artifacts, separate concern)
- **Data migration** — seed data handles fresh DBs; no need to migrate demo data
- **Multi-region or HA** — not needed for this stage

## Migration Phases

**Current state:** SQLite gives durable local/demo state with low deployment risk.

**Phase 1 (this change):** Migration-ready schema, provider abstraction, real EF migrations authored against SQL Server, missing FK fixed, explicit delete behaviors.

**Phase 2 (future cutover):** Provision Azure SQL, run SQL Server migrations, switch config, validate seed/startup, retire SQLite from production.

**Summary:** The schema and provider abstraction are production-ready. The app currently runs on SQLite for demo stability and uses a compatibility initializer to preserve existing local/demo data safely. The migration to Azure SQL is a config change plus pre-authored SQL Server migrations — no code deploy needed. Migrations are authored against SQL Server because that's the production target; SQLite is kept as a dev convenience rather than claiming cross-provider migration compatibility.

## Files Changed

| File | Change |
|------|--------|
| `TicketDeflection/TicketDeflection.csproj` | Add SqlServer package |
| `TicketDeflection/Program.cs` | Provider-conditional DbContext registration, Migrate() vs EnsureCreated() |
| `TicketDeflection/Data/SqliteDatabaseInitializer.cs` | Preserve SQLite compatibility-fix path for existing databases |
| `TicketDeflection/Data/TicketDbContext.cs` | Add ActivityLog FK, explicit delete behaviors |
| `TicketDeflection/Data/TicketDbContextFactory.cs` | Design-time SQL Server factory for EF migrations |
| `TicketDeflection/appsettings.json` | Add Database:Provider and ConnectionStrings section |
| `TicketDeflection/appsettings.Development.json` | Add Sqlite connection string |
| `TicketDeflection/Migrations/` | Initial SQL Server migration (generated) |
| `TicketDeflection.Tests/` | Provider selection test, SQLite compatibility coverage, design-time factory coverage |
