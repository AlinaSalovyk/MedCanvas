namespace MedCanvas.Application.Features.Auth;

/// <summary>
/// Result of a login attempt. When the user holds active memberships in several clinics
/// and did not specify one, <see cref="RequiresClinicSelection"/> is true, the token
/// fields stay null, and <see cref="Clinics"/> carries the selectable memberships.
/// </summary>
public sealed record LoginResultDto(
    bool RequiresClinicSelection,
    IReadOnlyList<ClinicMembershipSummaryDto> Clinics,
    string? Token,
    DateTime? ExpiresAtUtc,
    Guid? UserId,
    string? Email,
    string? FullName,
    Guid? ClinicId,
    string? ClinicName,
    string? Role)
{
    public static LoginResultDto SelectionRequired(IReadOnlyList<ClinicMembershipSummaryDto> clinics) =>
        new(true, clinics, null, null, null, null, null, null, null, null);

    public static LoginResultDto Authenticated(
        string token,
        DateTime expiresAtUtc,
        Guid userId,
        string email,
        string fullName,
        Guid clinicId,
        string clinicName,
        string role) =>
        new(false, Array.Empty<ClinicMembershipSummaryDto>(), token, expiresAtUtc, userId, email, fullName, clinicId, clinicName, role);
}
