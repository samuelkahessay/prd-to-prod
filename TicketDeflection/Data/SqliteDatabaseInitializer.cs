using Microsoft.EntityFrameworkCore;

namespace TicketDeflection.Data;

internal static class SqliteDatabaseInitializer
{
    public static async Task EnsureCreatedAndApplyCompatibilityFixesAsync(
        TicketDbContext context,
        CancellationToken cancellationToken = default)
    {
        await context.Database.EnsureCreatedAsync(cancellationToken);
        await ApplyCompatibilityFixesAsync(context, cancellationToken);
    }

    internal static async Task ApplyCompatibilityFixesAsync(
        TicketDbContext context,
        CancellationToken cancellationToken = default)
    {
        if (!context.Database.IsSqlite())
            return;

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            UPDATE "ComplianceDecisions"
            SET "Decision" = CASE
                WHEN "Decision" = 'Approve' THEN 'Approved'
                WHEN "Decision" = 'Reject' THEN 'Rejected'
                ELSE "Decision"
            END
            WHERE "Decision" IN ('Approve', 'Reject');
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            DELETE FROM "ComplianceDecisions"
            WHERE "Id" IN (
                SELECT "Id"
                FROM (
                    SELECT "Id",
                           ROW_NUMBER() OVER (
                               PARTITION BY "ScanId"
                               ORDER BY julianday("DecidedAt") DESC, "Id" DESC
                           ) AS "RowNum"
                    FROM "ComplianceDecisions"
                )
                WHERE "RowNum" > 1
            );
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ComplianceDecisions_ScanId"
            ON "ComplianceDecisions" ("ScanId");
            """,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
    }
}
