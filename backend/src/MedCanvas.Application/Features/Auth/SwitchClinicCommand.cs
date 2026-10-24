using MediatR;

namespace MedCanvas.Application.Features.Auth;

/// <summary>
/// Exchange the current token for one scoped to another clinic the user actively belongs to.
/// The target membership is re-verified against the database (revocation is instant).
/// </summary>
public sealed record SwitchClinicCommand(Guid ClinicId) : IRequest<LoginResultDto>;
