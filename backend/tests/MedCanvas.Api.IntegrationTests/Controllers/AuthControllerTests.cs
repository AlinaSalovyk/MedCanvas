using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Auth;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class AuthControllerTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;
    private readonly HttpClient _client;

    public AuthControllerTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAnonymousClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Login_WithValidCredentials_Returns200WithJwtTokenAndClaims()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var passwordHash = hasher.HashPassword("StrongP@ssw0rd123!");
        var user = User.Create("dr.smith@smiledental.com", "Dr. John Smith", passwordHash, now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);

        db.Clinics.Add(clinic);
        db.Users.Add(user);
        db.ClinicMemberships.Add(membership);
        await db.SaveChangesAsync();

        var command = new LoginCommand("dr.smith@smiledental.com", "StrongP@ssw0rd123!", clinic.Id);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<LoginResponseDto>();
        result.Should().NotBeNull();
        result!.Token.Should().NotBeNullOrWhiteSpace();
        result.Email.Should().Be("dr.smith@smiledental.com");
        result.FullName.Should().Be("Dr. John Smith");
        result.ClinicId.Should().Be(clinic.Id);
        result.ClinicName.Should().Be("Smile Dental Clinic");
        result.Role.Should().Be("Clinician");
    }

    [Fact]
    public async Task Login_WithInvalidPassword_Returns401Unauthorized()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var passwordHash = hasher.HashPassword("StrongP@ssw0rd123!");
        var user = User.Create("dr.smith@smiledental.com", "Dr. John Smith", passwordHash, now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);

        db.Clinics.Add(clinic);
        db.Users.Add(user);
        db.ClinicMemberships.Add(membership);
        await db.SaveChangesAsync();

        var command = new LoginCommand("dr.smith@smiledental.com", "WrongPassword123!", clinic.Id);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithNonExistentUser_Returns401Unauthorized()
    {
        // Arrange
        var command = new LoginCommand("unknown@smiledental.com", "SomePassword123!", Guid.NewGuid());

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WhenUserNotMemberOfClinic_Returns403Forbidden()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinicA = Clinic.Create("Clinic A", "CLINIC-A", now);
        var clinicB = Clinic.Create("Clinic B", "CLINIC-B", now);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var passwordHash = hasher.HashPassword("StrongP@ssw0rd123!");
        var user = User.Create("dr.external@example.com", "Dr. External", passwordHash, now);
        var membershipA = ClinicMembership.Create(clinicA.Id, user.Id, MembershipRole.Clinician, now);

        db.Clinics.AddRange(clinicA, clinicB);
        db.Users.Add(user);
        db.ClinicMemberships.Add(membershipA);
        await db.SaveChangesAsync();

        var command = new LoginCommand("dr.external@example.com", "StrongP@ssw0rd123!", clinicB.Id);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Login_WithInvalidEmailFormat_Returns400BadRequest()
    {
        // Arrange
        var command = new LoginCommand("invalid-email-no-at", "SomePassword123!", Guid.NewGuid());

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetCurrentUser_WhenAuthenticated_Returns200WithActiveUserClaims()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var passwordHash = hasher.HashPassword("StrongP@ssw0rd123!");
        var user = User.Create("dr.authorized@smiledental.com", "Dr. Authorized", passwordHash, now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.ClinicAdmin, now);

        db.Clinics.Add(clinic);
        db.Users.Add(user);
        db.ClinicMemberships.Add(membership);
        await db.SaveChangesAsync();

        var authClient = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.ClinicAdmin);

        // Act
        var response = await authClient.GetAsync("/api/v1/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<CurrentUserDto>();
        result.Should().NotBeNull();
        result!.UserId.Should().Be(user.Id);
        result.Email.Should().Be("dr.authorized@smiledental.com");
        result.FullName.Should().Be("Dr. Authorized");
        result.ClinicId.Should().Be(clinic.Id);
        result.Role.Should().Be("ClinicAdmin");
        result.IsAuthenticated.Should().BeTrue();
    }

    [Fact]
    public async Task GetCurrentUser_WhenUnauthenticated_Returns401Unauthorized()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithExpiredToken_Returns401Unauthorized()
    {
        // Arrange: Token expired 1 hour ago
        var expiredToken = TestJwtGenerator.GenerateTestToken(
            userId: Guid.NewGuid(),
            email: "expired@example.com",
            clinicId: Guid.NewGuid(),
            role: "Clinician",
            expiresAt: DateTime.UtcNow.AddHours(-1));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", expiredToken);

        // Act
        var response = await _client.SendAsync(request);

        // Assert - Expired JWT must return 401 Unauthorized
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithTamperedSignature_Returns401Unauthorized()
    {
        // Arrange: Generate valid token and alter payload characters
        var validToken = TestJwtGenerator.GenerateTestToken(
            userId: Guid.NewGuid(),
            email: "tampered@example.com",
            clinicId: Guid.NewGuid(),
            role: "Clinician",
            expiresAt: DateTime.UtcNow.AddHours(1));

        var parts = validToken.Split('.');
        // Tamper signature part
        var tamperedSignature = parts[2].Length > 5 ? parts[2][..^5] + "XXXXX" : "invalidSig";
        var tamperedToken = $"{parts[0]}.{parts[1]}.{tamperedSignature}";

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tamperedToken);

        // Act
        var response = await _client.SendAsync(request);

        // Assert - Tampered signature must fail cryptographic validation with 401
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithWrongIssuer_Returns401Unauthorized()
    {
        // Arrange: Generate token signed with wrong issuer
        var wrongIssuerToken = TestJwtGenerator.GenerateTestToken(
            userId: Guid.NewGuid(),
            email: "wrongissuer@example.com",
            clinicId: Guid.NewGuid(),
            role: "Clinician",
            expiresAt: DateTime.UtcNow.AddHours(1),
            issuer: "UntrustedExternalIssuer");

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", wrongIssuerToken);

        // Act
        var response = await _client.SendAsync(request);

        // Assert - Untrusted issuer must return 401
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithWrongAudience_Returns401Unauthorized()
    {
        // Arrange: Generate token signed with wrong audience
        var wrongAudienceToken = TestJwtGenerator.GenerateTestToken(
            userId: Guid.NewGuid(),
            email: "wrongaudience@example.com",
            clinicId: Guid.NewGuid(),
            role: "Clinician",
            expiresAt: DateTime.UtcNow.AddHours(1),
            audience: "OtherServiceAudience");

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", wrongAudienceToken);

        // Act
        var response = await _client.SendAsync(request);

        // Assert - Untrusted audience must return 401
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithMalformedToken_Returns401Unauthorized()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "not.a.valid.jwt.token");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithTokenSignedByPreviousCompromisedSecret_Returns401Unauthorized()
    {
        // Arrange: Generate token signed with the old compromised development key
        const string oldCompromisedSecret = "MedCanvasDevelopmentSecretKeyMustBeAtLeast32BytesLongForHmacSha256Security12345";
        var oldKeyToken = TestJwtGenerator.GenerateTestToken(
            userId: Guid.NewGuid(),
            email: "oldkey@example.com",
            clinicId: Guid.NewGuid(),
            role: "Clinician",
            expiresAt: DateTime.UtcNow.AddHours(1),
            secret: oldCompromisedSecret);

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", oldKeyToken);

        // Act
        var response = await _client.SendAsync(request);

        // Assert - Tokens signed with the old rotated key must be rejected with 401 Unauthorized
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}

