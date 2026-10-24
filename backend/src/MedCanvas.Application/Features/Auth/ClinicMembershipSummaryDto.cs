namespace MedCanvas.Application.Features.Auth;

/// <summary>An active clinic membership of the calling user (for the login picker and clinic switcher).</summary>
public sealed record ClinicMembershipSummaryDto(
    Guid ClinicId,
    string ClinicName,
    string ClinicIdentifier,
    string Role);
