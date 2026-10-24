using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Infrastructure;

public class DatabaseConfigurationStartupTests
{
    private const string ValidJwtSecret = "A-Cryptographically-Secure-Secret-Key-Of-At-Least-32-Bytes-Length!";

    [Fact]
    public void Startup_InProduction_WhenConnectionStringIsMissing_ThrowsInvalidOperationException()
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Production");
                builder.UseSetting("ConnectionStrings:DefaultConnection", "");
                builder.UseSetting("Jwt:Secret", ValidJwtSecret);
            });

        Action act = () => _ = factory.Services;

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Fatal configuration error: 'ConnectionStrings:DefaultConnection' is missing in non-development environment*");
    }

    [Fact]
    public void Startup_InProduction_WhenConnectionStringContainsPlaceholderCredentials_ThrowsInvalidOperationException()
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Production");
                builder.UseSetting("ConnectionStrings:DefaultConnection", "Host=prod.db;Database=medcanvas;Username=postgres;Password=postgres");
                builder.UseSetting("Jwt:Secret", ValidJwtSecret);
            });

        Action act = () => _ = factory.Services;

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Fatal security error: 'ConnectionStrings:DefaultConnection' contains default development credentials*");
    }

    [Fact]
    public void Startup_InDevelopment_WhenUsingDevelopmentSettings_DoesNotThrowConfigurationException()
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.UseSetting("Jwt:Secret", ValidJwtSecret);
            });

        Action act = () => _ = factory.Services;
        act.Should().NotThrow();
    }

    [Fact]
    public void Startup_InTesting_WhenUsingTestcontainersConnection_DoesNotThrowConfigurationException()
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.UseSetting("ConnectionStrings:DefaultConnection", "Host=localhost;Port=5432;Database=test;Username=postgres;Password=postgres");
                builder.UseSetting("Jwt:Secret", ValidJwtSecret);
            });

        Action act = () => _ = factory.Services;
        act.Should().NotThrow();
    }
}
