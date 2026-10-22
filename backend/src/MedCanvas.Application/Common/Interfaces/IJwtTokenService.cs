using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Service abstraction for issuing and validating cryptographically signed JWT tokens.
/// </summary>
public interface IJwtTokenService
{
    string GenerateToken(User user, Guid clinicId, MembershipRole role, DateTime expiresAtUtc);
}
