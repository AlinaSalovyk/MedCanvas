using MediatR;

namespace MedCanvas.Application.Features.Clinics;

/// <summary>
/// Create a staff account (brand-new user) with a role in the current clinic.
/// Binding an existing account requires that account's own login — never done here.
/// </summary>
public sealed record AddClinicMemberCommand(
    string Email,
    string FullName,
    string Password,
    string Role) : IRequest<ClinicMemberDto>;
