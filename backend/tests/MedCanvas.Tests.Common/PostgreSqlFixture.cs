using Testcontainers.PostgreSql;
using Xunit;

namespace MedCanvas.Tests.Common;

/// <summary>
/// Shared test fixture spinning up an isolated PostgreSQL 16 container via Testcontainers.
/// Pinned strictly to 'postgres:16-alpine' (never 'postgres:latest').
/// </summary>
public sealed class PostgreSqlFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("medcanvas_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
