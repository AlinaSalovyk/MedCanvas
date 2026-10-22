using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace MedCanvas.Api.IntegrationTests.Infrastructure;

public static class TestJwtGenerator
{
    public const string DefaultTestSecret = "MedCanvasLocalDevelopmentSecretKeyWithAtLeast256BitsForHmacSha256SecurityValidation!";
    public const string DefaultIssuer = "MedCanvas.Api";
    public const string DefaultAudience = "MedCanvas.Client";

    public static string GenerateTestToken(
        Guid userId,
        string email,
        Guid clinicId,
        string role,
        DateTime expiresAt,
        string? issuer = null,
        string? audience = null,
        string? secret = null)
    {
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret ?? DefaultTestSecret));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(JwtRegisteredClaimNames.Name, "Test Clinician"),
            new Claim("clinic_id", clinicId.ToString()),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer ?? DefaultIssuer,
            audience: audience ?? DefaultAudience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-5),
            expires: expiresAt,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
