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

        var connection = context.Database.GetDbConnection();
        var openedConnection = connection.State != System.Data.ConnectionState.Open;
        if (openedConnection)
            await connection.OpenAsync(cancellationToken);

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            if (await TableExistsAsync(connection, "ComplianceDecisions", cancellationToken))
            {
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

                if (!await HasForeignKeyAsync(
                    connection,
                    "ComplianceDecisions",
                    "ComplianceScans",
                    "ScanId",
                    "RESTRICT",
                    cancellationToken))
                {
                    await RebuildComplianceDecisionsTableAsync(context, cancellationToken);
                }

                await context.Database.ExecuteSqlRawAsync(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS "IX_ComplianceDecisions_ScanId"
                    ON "ComplianceDecisions" ("ScanId");
                    """,
                    cancellationToken);
            }

            if (await TableExistsAsync(connection, "ActivityLogs", cancellationToken)
                && !await HasForeignKeyAsync(
                    connection,
                    "ActivityLogs",
                    "Tickets",
                    "TicketId",
                    "CASCADE",
                    cancellationToken))
            {
                await RebuildActivityLogsTableAsync(context, cancellationToken);
            }

            if (await TableExistsAsync(connection, "ActivityLogs", cancellationToken))
            {
                await context.Database.ExecuteSqlRawAsync(
                    """
                    CREATE INDEX IF NOT EXISTS "IX_ActivityLogs_TicketId"
                    ON "ActivityLogs" ("TicketId");
                    """,
                    cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            if (openedConnection)
                await connection.CloseAsync();
        }
    }

    private static async Task RebuildComplianceDecisionsTableAsync(
        TicketDbContext context,
        CancellationToken cancellationToken)
    {
        await context.Database.ExecuteSqlRawAsync(
            """
            ALTER TABLE "ComplianceDecisions" RENAME TO "__ComplianceDecisions_Legacy";
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE "ComplianceDecisions" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ComplianceDecisions" PRIMARY KEY,
                "ScanId" TEXT NOT NULL,
                "OperatorId" TEXT NOT NULL,
                "Decision" TEXT NOT NULL,
                "Notes" TEXT NULL,
                "DecidedAt" TEXT NOT NULL,
                CONSTRAINT "FK_ComplianceDecisions_ComplianceScans_ScanId"
                    FOREIGN KEY ("ScanId") REFERENCES "ComplianceScans" ("Id") ON DELETE RESTRICT
            );
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO "ComplianceDecisions" ("Id", "ScanId", "OperatorId", "Decision", "Notes", "DecidedAt")
            SELECT "Id", "ScanId", "OperatorId", "Decision", "Notes", "DecidedAt"
            FROM "__ComplianceDecisions_Legacy";
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            DROP TABLE "__ComplianceDecisions_Legacy";
            """,
            cancellationToken);
    }

    private static async Task RebuildActivityLogsTableAsync(
        TicketDbContext context,
        CancellationToken cancellationToken)
    {
        await context.Database.ExecuteSqlRawAsync(
            """
            DELETE FROM "ActivityLogs"
            WHERE "TicketId" NOT IN (
                SELECT "Id"
                FROM "Tickets"
            );
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            ALTER TABLE "ActivityLogs" RENAME TO "__ActivityLogs_Legacy";
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE "ActivityLogs" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ActivityLogs" PRIMARY KEY,
                "TicketId" TEXT NOT NULL,
                "Action" TEXT NOT NULL,
                "Details" TEXT NOT NULL,
                "Timestamp" TEXT NOT NULL,
                CONSTRAINT "FK_ActivityLogs_Tickets_TicketId"
                    FOREIGN KEY ("TicketId") REFERENCES "Tickets" ("Id") ON DELETE CASCADE
            );
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO "ActivityLogs" ("Id", "TicketId", "Action", "Details", "Timestamp")
            SELECT "Id", "TicketId", "Action", "Details", "Timestamp"
            FROM "__ActivityLogs_Legacy";
            """,
            cancellationToken);

        await context.Database.ExecuteSqlRawAsync(
            """
            DROP TABLE "__ActivityLogs_Legacy";
            """,
            cancellationToken);
    }

    private static async Task<bool> TableExistsAsync(
        System.Data.Common.DbConnection connection,
        string tableName,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT COUNT(*)
            FROM "sqlite_master"
            WHERE "type" = 'table' AND "name" = $tableName;
            """;
        AddParameter(command, "$tableName", tableName);

        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken) ?? 0L) > 0;
    }

    private static async Task<bool> HasForeignKeyAsync(
        System.Data.Common.DbConnection connection,
        string tableName,
        string principalTable,
        string fromColumn,
        string expectedDeleteBehavior,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText =
            $"""
            SELECT COUNT(*)
            FROM pragma_foreign_key_list('{tableName}')
            WHERE "table" = $principalTable
              AND "from" = $fromColumn
              AND upper("on_delete") = $expectedDeleteBehavior;
            """;
        AddParameter(command, "$principalTable", principalTable);
        AddParameter(command, "$fromColumn", fromColumn);
        AddParameter(command, "$expectedDeleteBehavior", expectedDeleteBehavior);

        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken) ?? 0L) > 0;
    }

    private static void AddParameter(
        System.Data.Common.DbCommand command,
        string name,
        object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
