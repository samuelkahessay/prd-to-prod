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
