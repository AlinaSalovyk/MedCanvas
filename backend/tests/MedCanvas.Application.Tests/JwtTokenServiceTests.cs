using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace MedCanvas.Application.Tests;

public class JwtTokenServiceTests
{
    private readonly IConfiguration _config;
    private readonly JwtTokenService _service;
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);

    public JwtTokenServiceTests()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Jwt:Key", "ThisIsASecretKeyForTestingJwtTokenGenerationWithMinimum256BitsLength!" },
            { "Jwt:Issuer", "TestIssuer" },
            { "Jwt:Audience", "TestAudience" }
        };

        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _service = new JwtTokenService(_config);
    }

    [Fact]
    public void GenerateToken_ProducesValidJwtWithExpectedClaims()
    {
        var user = User.Create("dr.dentist@example.com", "Dr. Jane Dentist", "hash", _now);
        var clinicId = Guid.NewGuid();
        var expiresAt = _now.AddHours(2);

        var tokenString = _service.GenerateToken(user, clinicId, MembershipRole.Clinician, expiresAt);

        tokenString.Should().NotBeNullOrWhiteSpace();

        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(tokenString);

        token.Issuer.Should().Be("TestIssuer");
        token.Audiences.Should().Contain("TestAudience");

        token.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value.Should().Be(user.Id.ToString());
        token.Claims.First(c => c.Type == JwtRegisteredClaimNames.Email).Value.Should().Be("dr.dentist@example.com");
        token.Claims.First(c => c.Type == "clinic_id").Value.Should().Be(clinicId.ToString());
        token.Claims.First(c => c.Type == ClaimTypes.Role).Value.Should().Be("Clinician");
        token.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Jti);
    }
}
