using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Features.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

/// <summary>
/// Credential-stuffing protection: the anonymous auth endpoints are rate limited per IP.
/// Uses a dedicated host with a two-request limit so the 429 path is deterministic.
/// </summary>
public class RateLimitingTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public RateLimitingTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => Task.CompletedTask;

    private WebApplicationFactory<Program> CreateLowLimitFactory() =>
        _factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimiting:Auth:PermitLimit", "2");
            builder.UseSetting("RateLimiting:Auth:WindowSeconds", "60");
        });

    [Fact]
    public async Task Login_BurstBeyondLimit_Returns429WithProblemDetails()
    {
        using var factory = CreateLowLimitFactory();
        var client = factory.CreateClient();

        var command = new LoginCommand("nobody@example.com", "WrongPassword1!");

        var first = await client.PostAsJsonAsync("/api/v1/auth/login", command);
        var second = await client.PostAsJsonAsync("/api/v1/auth/login", command);

        // The limiter counts requests regardless of auth outcome, so two attempts exhaust a 2-permit window.
        first.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        second.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var third = await client.PostAsJsonAsync("/api/v1/auth/login", command);
        third.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        third.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        var body = await third.Content.ReadAsStringAsync();
        body.Should().Contain("rate-limited");
    }

    [Fact]
    public async Task Onboarding_BurstBeyondLimit_Returns429()
    {
        using var factory = CreateLowLimitFactory();
        var client = factory.CreateClient();

        var payload = new
        {
            clinicName = "Burst Clinic",
            clinicIdentifier = "BURST-01",
            adminEmail = "burst@example.com",
            adminFullName = "Burst",
            adminPassword = "Weak"
        };

        await client.PostAsJsonAsync("/api/v1/clinics/onboarding", payload);
        await client.PostAsJsonAsync("/api/v1/clinics/onboarding", payload);

        var third = await client.PostAsJsonAsync("/api/v1/clinics/onboarding", payload);
        third.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }
}
