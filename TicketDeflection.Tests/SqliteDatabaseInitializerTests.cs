using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

public class SqliteDatabaseInitializerTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _dbPath;

    public SqliteDatabaseInitializerTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"TicketDeflectionSqliteTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);
        _dbPath = Path.Combine(_tempDir, "ticketdb.db");
    }

    [Fact]
    public async Task ApplyCompatibilityFixesAsync_NormalizesLegacyValues_Deduplicates_AndAddsUniqueIndex()
    {
        await using (var connection = new SqliteConnection($"Data Source={_dbPath}"))
        {
            await connection.OpenAsync();

            var setup = connection.CreateCommand();
            setup.CommandText =
                """
                CREATE TABLE "ComplianceScans" (
                    "Id" TEXT NOT NULL CONSTRAINT "PK_ComplianceScans" PRIMARY KEY,
                    "SubmittedAt" TEXT NOT NULL,
                    "ContentType" INTEGER NOT NULL,
                    "SourceLabel" TEXT NULL,
                    "Disposition" INTEGER NOT NULL,
                    "IsDemo" INTEGER NOT NULL
                );

                CREATE TABLE "ComplianceDecisions" (
                    "Id" TEXT NOT NULL CONSTRAINT "PK_ComplianceDecisions" PRIMARY KEY,
                    "ScanId" TEXT NOT NULL,
                    "OperatorId" TEXT NOT NULL,
                    "Decision" TEXT NOT NULL,
                    "Notes" TEXT NULL,
                    "DecidedAt" TEXT NOT NULL,
                    CONSTRAINT "FK_ComplianceDecisions_ComplianceScans_ScanId"
                        FOREIGN KEY ("ScanId") REFERENCES "ComplianceScans" ("Id") ON DELETE CASCADE
                );
                """;
            await setup.ExecuteNonQueryAsync();

            var scanOneId = Guid.NewGuid();
            var scanTwoId = Guid.NewGuid();

            var seed = connection.CreateCommand();
            seed.CommandText =
                """
                INSERT INTO "ComplianceScans" ("Id", "SubmittedAt", "ContentType", "SourceLabel", "Disposition", "IsDemo")
                VALUES ($scanOneId, '2026-03-03T00:00:00+00:00', 0, 'one', 1, 0),
                       ($scanTwoId, '2026-03-03T00:05:00+00:00', 0, 'two', 1, 0);

                INSERT INTO "ComplianceDecisions" ("Id", "ScanId", "OperatorId", "Decision", "Notes", "DecidedAt")
                VALUES ($firstId, $scanOneId, 'operator-a', 'Approve', 'first', '2026-03-03T00:01:00+00:00'),
                       ($secondId, $scanOneId, 'operator-b', 'Reject', 'second', '2026-03-03T00:02:00+00:00'),
                       ($thirdId, $scanTwoId, 'operator-c', 'Approve', 'third', '2026-03-03T00:03:00+00:00');
                """;
            seed.Parameters.AddWithValue("$scanOneId", scanOneId);
            seed.Parameters.AddWithValue("$scanTwoId", scanTwoId);
            seed.Parameters.AddWithValue("$firstId", Guid.NewGuid());
            seed.Parameters.AddWithValue("$secondId", Guid.NewGuid());
            seed.Parameters.AddWithValue("$thirdId", Guid.NewGuid());
            await seed.ExecuteNonQueryAsync();
        }

        await using (var context = CreateContext())
        {
            await SqliteDatabaseInitializer.ApplyCompatibilityFixesAsync(context);
        }

        await using var verification = new SqliteConnection($"Data Source={_dbPath}");
        await verification.OpenAsync();

        var remainingDecisions = verification.CreateCommand();
        remainingDecisions.CommandText =
            """
            SELECT "ScanId", "Decision"
            FROM "ComplianceDecisions"
            ORDER BY "ScanId";
            """;

        var rows = new List<(string ScanId, string Decision)>();
        await using (var reader = await remainingDecisions.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
                rows.Add((reader.GetString(0), reader.GetString(1)));
        }

        Assert.Equal(2, rows.Count);
        Assert.All(rows, row => Assert.DoesNotContain(row.Decision, new[] { "Approve", "Reject" }));
        Assert.Contains(rows, row => row.Decision == "Rejected");
        Assert.Contains(rows, row => row.Decision == "Approved");

        var indexLookup = verification.CreateCommand();
        indexLookup.CommandText =
            """
            SELECT COUNT(*)
            FROM pragma_index_list('ComplianceDecisions')
            WHERE "name" = 'IX_ComplianceDecisions_ScanId' AND "unique" = 1;
            """;
        var indexCount = (long)(await indexLookup.ExecuteScalarAsync() ?? 0L);
        Assert.Equal(1L, indexCount);

        var fkLookup = verification.CreateCommand();
        fkLookup.CommandText =
            """
            SELECT "on_delete"
            FROM pragma_foreign_key_list('ComplianceDecisions')
            WHERE "table" = 'ComplianceScans' AND "from" = 'ScanId';
            """;
        var deleteBehavior = (string?)await fkLookup.ExecuteScalarAsync();
        Assert.Equal("RESTRICT", deleteBehavior);
    }

    [Fact]
    public async Task ApplyCompatibilityFixesAsync_RebuildsLegacyActivityLogsTable_AndRemovesOrphans()
    {
        var validTicketId = Guid.NewGuid();

        await using (var connection = new SqliteConnection($"Data Source={_dbPath}"))
        {
            await connection.OpenAsync();

            var setup = connection.CreateCommand();
            setup.CommandText =
                """
                CREATE TABLE "Tickets" (
                    "Id" TEXT NOT NULL CONSTRAINT "PK_Tickets" PRIMARY KEY,
                    "Title" TEXT NOT NULL,
                    "Description" TEXT NOT NULL,
                    "Category" INTEGER NOT NULL,
                    "Severity" INTEGER NOT NULL,
                    "Status" INTEGER NOT NULL,
                    "Resolution" TEXT NULL,
                    "Source" TEXT NOT NULL,
                    "CreatedAt" TEXT NOT NULL,
                    "UpdatedAt" TEXT NOT NULL
                );

                CREATE TABLE "ActivityLogs" (
                    "Id" TEXT NOT NULL CONSTRAINT "PK_ActivityLogs" PRIMARY KEY,
                    "TicketId" TEXT NOT NULL,
                    "Action" TEXT NOT NULL,
                    "Details" TEXT NOT NULL,
                    "Timestamp" TEXT NOT NULL
                );
                """;
            await setup.ExecuteNonQueryAsync();

            var seed = connection.CreateCommand();
            seed.CommandText =
                """
                INSERT INTO "Tickets" ("Id", "Title", "Description", "Category", "Severity", "Status", "Resolution", "Source", "CreatedAt", "UpdatedAt")
                VALUES ($validTicketId, 'ticket', 'desc', 0, 0, 0, NULL, 'web', '2026-03-03T00:00:00Z', '2026-03-03T00:00:00Z');

                INSERT INTO "ActivityLogs" ("Id", "TicketId", "Action", "Details", "Timestamp")
                VALUES ($validLogId, $validTicketId, 'Created', 'valid', '2026-03-03T00:00:00Z'),
                       ($orphanLogId, $orphanTicketId, 'Created', 'orphan', '2026-03-03T00:01:00Z');
                """;
            seed.Parameters.AddWithValue("$validTicketId", validTicketId);
            seed.Parameters.AddWithValue("$validLogId", Guid.NewGuid());
            seed.Parameters.AddWithValue("$orphanLogId", Guid.NewGuid());
            seed.Parameters.AddWithValue("$orphanTicketId", Guid.NewGuid());
            await seed.ExecuteNonQueryAsync();
        }

        await using (var context = CreateContext())
        {
            await SqliteDatabaseInitializer.ApplyCompatibilityFixesAsync(context);
        }

        await using var verification = new SqliteConnection($"Data Source={_dbPath}");
        await verification.OpenAsync();

        var enableForeignKeys = verification.CreateCommand();
        enableForeignKeys.CommandText = "PRAGMA foreign_keys = ON;";
        await enableForeignKeys.ExecuteNonQueryAsync();

        var fkLookup = verification.CreateCommand();
        fkLookup.CommandText =
            """
            SELECT "on_delete"
            FROM pragma_foreign_key_list('ActivityLogs')
            WHERE "table" = 'Tickets' AND "from" = 'TicketId';
            """;
        var deleteBehavior = (string?)await fkLookup.ExecuteScalarAsync();
        Assert.Equal("CASCADE", deleteBehavior);

        var countLogs = verification.CreateCommand();
        countLogs.CommandText = "SELECT COUNT(*) FROM \"ActivityLogs\";";
        var remainingLogs = (long)(await countLogs.ExecuteScalarAsync() ?? 0L);
        Assert.Equal(1L, remainingLogs);

        var deleteTicket = verification.CreateCommand();
        deleteTicket.CommandText = "DELETE FROM \"Tickets\" WHERE \"Id\" = $validTicketId;";
        deleteTicket.Parameters.AddWithValue("$validTicketId", validTicketId);
        await deleteTicket.ExecuteNonQueryAsync();

        var remainingAfterCascade = (long)(await countLogs.ExecuteScalarAsync() ?? 0L);
        Assert.Equal(0L, remainingAfterCascade);
    }

    private TicketDbContext CreateContext()
    {
        return new TicketDbContext(new DbContextOptionsBuilder<TicketDbContext>()
            .UseSqlite($"Data Source={_dbPath}")
            .Options);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, recursive: true);
    }
}
