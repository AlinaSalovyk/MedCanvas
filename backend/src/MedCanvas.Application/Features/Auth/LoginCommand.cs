using MediatR;

namespace MedCanvas.Application.Features.Auth;

/// <summary>
/// Authenticate a user. When <see cref="ClinicId"/> is omitted the single active membership
/// is auto-selected; multiple memberships yield a selection-required result listing them.
/// </summary>
public sealed record LoginCommand(
    string Email,
    string Password,
    Guid? ClinicId = null) : IRequest<LoginResultDto>;
