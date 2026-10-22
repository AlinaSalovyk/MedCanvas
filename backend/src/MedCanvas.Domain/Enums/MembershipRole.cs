namespace MedCanvas.Domain.Enums;

/// <summary>
/// Roles defining user permissions within a specific clinic tenant.
/// </summary>
public enum MembershipRole
{
    Clinician = 1,
    ClinicAdmin = 2,
    Assistant = 3
}
