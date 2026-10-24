using MedCanvas.Application.Features.Auth;
using MediatR;

namespace MedCanvas.Application.Features.Clinics;

/// <summary>
/// Controlled tenant onboarding: creates a brand-new clinic together with its first
/// ClinicAdmin account and membership in one transaction, and returns an authenticated
/// token for that administrator. Existing emails and clinic identifiers are rejected.
/// </summary>
public sealed record OnboardClinicCommand(
    string ClinicName,
    string ClinicIdentifier,
    string AdminEmail,
    string AdminFullName,
    string AdminPassword,
    string TimeZoneId = "Europe/Kyiv") : IRequest<LoginResultDto>;
