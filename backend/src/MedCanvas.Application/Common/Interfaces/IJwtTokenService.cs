using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Service abstraction for issuing and validating cryptographically signed JWT tokens.
/// </summary>
public interface IJwtTokenService
{
    string GenerateToken(User user, Guid clinicId, MembershipRole role, DateTime expiresAtUtc);

    /// <summary>
    /// Default token expiry derived from the configured <c>Jwt:ExpiryMinutes</c>
    /// (clamped to 5–1440 minutes, default 480).
    /// </summary>
    DateTime ComputeDefaultExpiry(DateTime utcNow);
}
