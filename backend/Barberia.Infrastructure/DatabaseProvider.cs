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
        var value = Sanitize(connectionString);
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
     * Normalizes Neon/Postgres connection strings for reliable SSL in Docker/Render.
     * Render env vars often truncate "?sslmode=require" at the "=" character.
     * @param connectionString Raw connection string or URI.
     */
    public static string Normalize(string connectionString)
    {
        var value = RepairTruncatedSslMode(Sanitize(connectionString));
        if (!IsPostgreSql(value))
        {
            return value;
        }

        return value.StartsWith("postgres", StringComparison.OrdinalIgnoreCase)
            ? FromUri(value)
            : FromKeyValue(value);
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

    private static string Sanitize(string connectionString) =>
        connectionString.Trim().Trim('"', '\'');

    private static string RepairTruncatedSslMode(string value)
    {
        // Render: ConnectionStrings__DefaultConnection=...sslmode=require
        // often becomes "...sslmode" because "=" starts a new assignment.
        if (value.EndsWith("?sslmode", StringComparison.OrdinalIgnoreCase)
            || value.EndsWith("&sslmode", StringComparison.OrdinalIgnoreCase)
            || value.EndsWith("SSL Mode", StringComparison.OrdinalIgnoreCase)
            || value.EndsWith("SslMode", StringComparison.OrdinalIgnoreCase))
        {
            return value + "=require";
        }

        return value;
    }

    private static string FromUri(string uriString)
    {
        var uri = new Uri(uriString);
        var userInfo = uri.UserInfo.Split(':', 2);
        var username = Uri.UnescapeDataString(userInfo[0]);
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
        var database = uri.AbsolutePath.Trim('/');
        if (string.IsNullOrWhiteSpace(database))
        {
            database = "neondb";
        }

        var builder = CreateBuilder(
            ToPoolerHost(uri.Host),
            uri.IsDefaultPort ? 5432 : uri.Port,
            username,
            password,
            database);

        return builder.ConnectionString;
    }

    private static string FromKeyValue(string value)
    {
        var builder = new NpgsqlConnectionStringBuilder(value)
        {
            SslMode = SslMode.Require,
            Timeout = 60,
            CommandTimeout = 60,
            KeepAlive = 30,
        };

        if (!string.IsNullOrWhiteSpace(builder.Host))
        {
            builder.Host = ToPoolerHost(builder.Host);
        }

        return builder.ConnectionString;
    }

    private static NpgsqlConnectionStringBuilder CreateBuilder(
        string host,
        int port,
        string username,
        string password,
        string database) =>
        new()
        {
            Host = host,
            Port = port,
            Username = username,
            Password = password,
            Database = database,
            SslMode = SslMode.Require,
            Timeout = 60,
            CommandTimeout = 60,
            KeepAlive = 30,
        };

    private static string ToPoolerHost(string host)
    {
        if (!host.Contains(".neon.tech", StringComparison.OrdinalIgnoreCase)
            || host.Contains("-pooler.", StringComparison.OrdinalIgnoreCase))
        {
            return host;
        }

        var firstDot = host.IndexOf('.');
        return firstDot > 0 ? host.Insert(firstDot, "-pooler") : host;
    }
}
