namespace MedCanvas.Application.Features.Clinics;

/// <summary>A staff membership row in the current clinic (includes revoked members for history).</summary>
public sealed record ClinicMemberDto(
    Guid UserId,
    string Email,
    string FullName,
    string Role,
    bool MembershipActive,
    bool UserActive,
    DateTime MemberSinceUtc);
