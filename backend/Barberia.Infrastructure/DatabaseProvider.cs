using Microsoft.EntityFrameworkCore;

namespace Barberia.Infrastructure;

/// <summary>
/// Selects the EF Core database provider from a connection string.
/// </summary>
public static class DatabaseProvider
{
    /**
     * Returns true when the connection string targets PostgreSQL.
     * @param connectionString Database connection string.
     */
    public static bool IsPostgreSql(string connectionString)
    {
        var value = connectionString.Trim();
        if (value.Contains("Data Source=", StringComparison.OrdinalIgnoreCase)
            || value.Contains("Filename=", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return value.StartsWith("postgres", StringComparison.OrdinalIgnoreCase)
            || value.Contains("Host=", StringComparison.OrdinalIgnoreCase)
            || value.Contains("Username=", StringComparison.OrdinalIgnoreCase)
            || value.Contains("User ID=", StringComparison.OrdinalIgnoreCase);
    }

    /**
     * Configures SQLite for local development or PostgreSQL for production hosts.
     * @param options EF Core options builder.
     * @param connectionString Database connection string.
     */
    public static void Configure(DbContextOptionsBuilder options, string connectionString)
    {
        if (IsPostgreSql(connectionString))
        {
            options.UseNpgsql(connectionString);
            return;
        }

        options.UseSqlite(connectionString);
    }
}
