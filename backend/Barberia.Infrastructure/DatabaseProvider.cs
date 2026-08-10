using Microsoft.EntityFrameworkCore;
using Npgsql;

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
        var value = connectionString.Trim().Trim('"', '\'');
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
     * Normalizes Neon/Postgres connection strings for reliable SSL in Docker.
     * @param connectionString Raw connection string or URI.
     */
    public static string Normalize(string connectionString)
    {
        var value = connectionString.Trim().Trim('"', '\'');
        if (!IsPostgreSql(value))
        {
            return value;
        }

        var builder = new NpgsqlConnectionStringBuilder(value)
        {
            SslMode = SslMode.Require,
            TrustServerCertificate = true,
            Timeout = 60,
            CommandTimeout = 60,
            KeepAlive = 30,
        };

        // Neon serverless works best through the pooler endpoint when available.
        // ep-xxx.region.aws.neon.tech -> ep-xxx-pooler.region.aws.neon.tech
        if (!string.IsNullOrWhiteSpace(builder.Host)
            && builder.Host.Contains(".neon.tech", StringComparison.OrdinalIgnoreCase)
            && !builder.Host.Contains("-pooler.", StringComparison.OrdinalIgnoreCase))
        {
            var firstDot = builder.Host.IndexOf('.');
            if (firstDot > 0)
            {
                builder.Host = builder.Host.Insert(firstDot, "-pooler");
            }
        }

        return builder.ConnectionString;
    }

    /**
     * Configures SQLite for local development or PostgreSQL for production hosts.
     * @param options EF Core options builder.
     * @param connectionString Database connection string.
     */
    public static void Configure(DbContextOptionsBuilder options, string connectionString)
    {
        var normalized = Normalize(connectionString);
        if (IsPostgreSql(normalized))
        {
            options.UseNpgsql(normalized);
            return;
        }

        options.UseSqlite(normalized);
    }
}
