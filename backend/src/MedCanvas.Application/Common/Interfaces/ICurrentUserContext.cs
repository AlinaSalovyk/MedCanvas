using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Provides identity and tenant clinic context for the active authenticated caller.
/// </summary>
public interface ICurrentUserContext
{
    Guid? UserId { get; }
    Guid? ClinicId { get; }
    string? Email { get; }
    MembershipRole? Role { get; }
    bool IsAuthenticated { get; }
}
