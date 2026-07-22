using System.Net;
using System.Net.Http.Json;
using Barberia.Api;
using Barberia.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Barberia.IntegrationTests;

public sealed class BarberiaApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databasePath =
        Path.Combine(Path.GetTempPath(), $"barberia-tests-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = $"Data Source={_databasePath}"
            });
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (File.Exists(_databasePath))
        {
            File.Delete(_databasePath);
        }
    }
}

public sealed class ApiSmokeTests(BarberiaApiFactory factory)
    : IClassFixture<BarberiaApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient(
        new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithSeedAdmin_ReturnsToken()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email = DatabaseSeeder.DevelopmentAdminEmail,
            password = DatabaseSeeder.DevelopmentAdminPassword
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.False(string.IsNullOrWhiteSpace(payload?.AccessToken));
        Assert.Contains("Admin", payload?.Roles ?? []);
    }

    [Fact]
    public async Task Services_ReturnsSeedServices()
    {
        var response = await _client.GetAsync("/api/v1/services");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("Classic Haircut", json);
    }
}
